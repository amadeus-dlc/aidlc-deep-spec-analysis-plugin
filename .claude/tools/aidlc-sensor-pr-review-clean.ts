// pr-review-clean センサー — 「PR コメントの放置」を機械的に可視化する。
//
// 検査対象は現在のブランチの open PR（env AIDLC_PR_REVIEW_PR で番号を明示
// 上書き可能。上書き時は closed/merged PR も監査対象になる——red/green の
// 実証や事後監査に使うための意図的な仕様で、verdict に state を明示する）。
// 2 つの観測面を見る:
//   1. 未解決レビュースレッド数（GraphQL reviewThreads.isResolved、全ページ走査）
//   2. 未完了のレビュー系チェック（CodeRabbit/Bugbot/review の CheckRun が
//      COMPLETED 以外、または StatusContext が PENDING/EXPECTED）
// どちらかが残っていれば pass: false。open PR が無ければ pass-through。
// gh 不在・認証切れ・ネットワーク不通は pass: false / note: "unavailable"
// で理由を明示する（沈黙した緑は出さない）。
//
// タイムアウト予算: 個々の外部コマンドは 6s、呼び出しは直列で最大
// 4+ページ数回 — マニフェストの timeout_seconds: 30 に収まる設計。
//
// センサー契約: --stage / --output-path のみ解釈、stdout に verdict 1 行、
// 実 verdict は常に exit 0。advisory — 何もブロックしない。

import { spawnSync } from "node:child_process";

const COMMAND_TIMEOUT_MS = 6_000;
const MAX_THREAD_PAGES = 10;

function sh(cmd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const res = spawnSync(cmd, args, { encoding: "utf-8", timeout: COMMAND_TIMEOUT_MS });
  return { ok: !res.error && res.status === 0, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim() };
}

function verdict(v: { [k: string]: unknown }): never {
  process.stdout.write(`${JSON.stringify(v)}\n`);
  process.exit(0);
}

function unavailable(reason: string): never {
  verdict({ pass: false, unresolved_threads: 0, pending_reviews: [], pr: "", state: "", note: "unavailable", reason });
}

interface CheckNode {
  __typename: string;
  name?: string;
  status?: string;
  context?: string;
  state?: string;
}

function main(): void {
  // 契約上のフラグは受けるが、この検査の対象は PR であってファイルではない。
  // output-path は matches ゲート専用。

  let prNumber = process.env.AIDLC_PR_REVIEW_PR ?? "";
  const explicit = prNumber !== "";
  if (!explicit) {
    const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch.ok) unavailable(`git branch unreadable: ${branch.err}`);
    const view = sh("gh", ["pr", "view", branch.out, "--json", "number,state,url"]);
    if (!view.ok) {
      // 「このブランチに PR が無い」だけを pass-through にする。リポジトリ
      // 解決失敗・認証切れ等を no-open-pr に混ぜると沈黙した緑になる。
      if (/no pull requests found/i.test(view.err)) {
        verdict({ pass: true, unresolved_threads: 0, pending_reviews: [], pr: "", state: "", note: "no-open-pr" });
      }
      unavailable(`gh pr view failed: ${view.err.slice(0, 200)}`);
    }
    const info = JSON.parse(view.out) as { number: number; state: string; url: string };
    if (info.state !== "OPEN") {
      verdict({ pass: true, unresolved_threads: 0, pending_reviews: [], pr: info.url, state: info.state, note: "no-open-pr" });
    }
    prNumber = String(info.number);
  }

  const repo = sh("gh", ["repo", "view", "--json", "owner,name", "--jq", '"\\(.owner.login) \\(.name)"']);
  if (!repo.ok) unavailable(`gh repo view failed: ${repo.err.slice(0, 200)}`);
  const [owner, name] = repo.out.split(" ");

  // 1 ページ目: PR の状態・チェック群・スレッド先頭ページをまとめて取得。
  const query = `query($owner:String!,$name:String!,$pr:Int!,$cursor:String){
    repository(owner:$owner,name:$name){ pullRequest(number:$pr){
      url state
      reviewThreads(first:100, after:$cursor){
        pageInfo{ hasNextPage endCursor }
        nodes{ isResolved }
      }
      commits(last:1){ nodes{ commit{ statusCheckRollup{ contexts(first:100){ nodes{
        __typename ... on CheckRun { name status } ... on StatusContext { context state } } } } } } }
    } } }`;

  interface Page {
    data: { repository: { pullRequest: {
      url: string;
      state: string;
      reviewThreads: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { isResolved: boolean }[] };
      commits: { nodes: { commit: { statusCheckRollup: { contexts: { nodes: CheckNode[] } } | null } }[] };
    } | null } };
  }

  function fetchPage(cursor: string | null): Page["data"]["repository"]["pullRequest"] {
    const args = [
      "api", "graphql",
      "-F", `owner=${owner}`, "-F", `name=${name}`, "-F", `pr=${prNumber}`,
      "-f", `query=${query}`,
    ];
    if (cursor !== null) args.push("-F", `cursor=${cursor}`);
    const gql = sh("gh", args);
    if (!gql.ok) unavailable(`gh api graphql failed: ${gql.err.slice(0, 200)}`);
    const page = (JSON.parse(gql.out) as Page).data.repository.pullRequest;
    if (!page) unavailable(`PR #${prNumber} not found`);
    return page;
  }

  let page = fetchPage(null);
  const prUrl = page.url;
  const prState = page.state;
  const contexts = page.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? [];

  let unresolved = page.reviewThreads.nodes.filter((t) => !t.isResolved).length;
  let pages = 1;
  while (page.reviewThreads.pageInfo.hasNextPage) {
    if (pages >= MAX_THREAD_PAGES) {
      // 打ち切りを「全部見た」ことにしない — 明示 fail で切る。
      verdict({ pass: false, unresolved_threads: unresolved, pending_reviews: [], pr: prUrl, state: prState, note: "thread-scan-truncated" });
    }
    page = fetchPage(page.reviewThreads.pageInfo.endCursor);
    unresolved += page.reviewThreads.nodes.filter((t) => !t.isResolved).length;
    pages += 1;
  }

  // レビュー系チェック（CodeRabbit/Bugbot/名前に review を含むもの）だけを見る。
  // CI そのものの pending は別の関心事なのでここでは数えない。
  //   CheckRun: COMPLETED 以外（QUEUED/IN_PROGRESS/WAITING/PENDING/REQUESTED）は全て未完了。
  //   StatusContext: PENDING と EXPECTED が未完了。
  const pendingReviews = contexts
    .filter((c) => {
      const label = c.name ?? c.context ?? "";
      if (!/coderabbit|bugbot|review/i.test(label)) return false;
      if (c.__typename === "CheckRun") return (c.status ?? "").toUpperCase() !== "COMPLETED";
      const state = (c.state ?? "").toUpperCase();
      return state === "PENDING" || state === "EXPECTED";
    })
    .map((c) => c.name ?? c.context ?? "unknown");

  verdict({
    pass: unresolved === 0 && pendingReviews.length === 0,
    unresolved_threads: unresolved,
    pending_reviews: pendingReviews,
    pr: prUrl,
    state: prState,
    note: explicit && prState !== "OPEN" ? "explicit-audit-of-non-open-pr" : "",
  });
}

main();
