// pr-review-clean センサー — 「PR コメントの放置」を機械的に可視化する。
//
// 検査対象は現在のブランチの open PR（env AIDLC_PR_REVIEW_PR で番号を明示
// 上書き可能。儀式やテストからの実射用）。2 つの観測面を見る:
//   1. 未解決レビュースレッド数（GraphQL reviewThreads.isResolved）
//   2. 進行中のレビュー系チェック（名前に review/coderabbit/bugbot を含む
//      check の pending）
// どちらかが残っていれば pass: false。open PR が無ければ pass-through。
// gh 不在・認証切れ・ネットワーク不通は pass: false / note: "unavailable"
// で理由を明示する（沈黙した緑は出さない）。
//
// センサー契約: --stage / --output-path のみ解釈、stdout に verdict 1 行、
// 実 verdict は常に exit 0。advisory — 何もブロックしない。

import { spawnSync } from "node:child_process";

function sh(cmd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const res = spawnSync(cmd, args, { encoding: "utf-8", timeout: 25_000 });
  return { ok: !res.error && res.status === 0, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim() };
}

function verdict(v: { [k: string]: unknown }): never {
  process.stdout.write(`${JSON.stringify(v)}\n`);
  process.exit(0);
}

function unavailable(reason: string): never {
  verdict({ pass: false, unresolved_threads: 0, pending_reviews: [], pr: "", note: "unavailable", reason });
}

function main(): void {
  // 契約上のフラグは受けるが、この検査の対象は PR であってファイルではない。
  // output-path は matches ゲート専用。

  let prNumber = process.env.AIDLC_PR_REVIEW_PR ?? "";
  if (!prNumber) {
    const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch.ok) unavailable(`git branch unreadable: ${branch.err}`);
    const view = sh("gh", ["pr", "view", branch.out, "--json", "number,state,url"]);
    if (!view.ok) {
      // gh は「PR なし」も非ゼロで返す。認証・ネットワーク系と区別する。
      if (/no pull requests found|Could not resolve/i.test(view.err)) {
        verdict({ pass: true, unresolved_threads: 0, pending_reviews: [], pr: "", note: "no-open-pr" });
      }
      unavailable(`gh pr view failed: ${view.err.slice(0, 200)}`);
    }
    const info = JSON.parse(view.out) as { number: number; state: string; url: string };
    if (info.state !== "OPEN") {
      verdict({ pass: true, unresolved_threads: 0, pending_reviews: [], pr: info.url, note: "no-open-pr" });
    }
    prNumber = String(info.number);
  }

  const repo = sh("gh", ["repo", "view", "--json", "owner,name", "--jq", '"\\(.owner.login) \\(.name)"']);
  if (!repo.ok) unavailable(`gh repo view failed: ${repo.err.slice(0, 200)}`);
  const [owner, name] = repo.out.split(" ");

  const query = `query($owner:String!,$name:String!,$pr:Int!){
    repository(owner:$owner,name:$name){ pullRequest(number:$pr){
      url
      reviewThreads(first:100){ nodes{ isResolved path } }
      statusCheckRollup: commits(last:1){ nodes{ commit{ statusCheckRollup{ contexts(first:50){ nodes{
        __typename ... on CheckRun { name status } ... on StatusContext { context state } } } } } } }
    } } }`;
  const gql = sh("gh", [
    "api", "graphql",
    "-F", `owner=${owner}`, "-F", `name=${name}`, "-F", `pr=${prNumber}`,
    "-f", `query=${query}`,
  ]);
  if (!gql.ok) unavailable(`gh api graphql failed: ${gql.err.slice(0, 200)}`);

  interface CheckNode { __typename: string; name?: string; status?: string; context?: string; state?: string }
  const data = JSON.parse(gql.out) as {
    data: { repository: { pullRequest: {
      url: string;
      reviewThreads: { nodes: { isResolved: boolean; path: string | null }[] };
      statusCheckRollup: { nodes: { commit: { statusCheckRollup: { contexts: { nodes: CheckNode[] } } | null } }[] };
    } | null } };
  };
  const pr = data.data.repository.pullRequest;
  if (!pr) unavailable(`PR #${prNumber} not found`);

  const unresolved = pr.reviewThreads.nodes.filter((t) => !t.isResolved);
  const contexts = pr.statusCheckRollup.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? [];
  // レビュー系チェック（CodeRabbit/Bugbot/名前に review を含むもの）の進行中だけを見る。
  // CI そのものの pending は別の関心事なのでここでは数えない。
  const pendingReviews = contexts
    .filter((c) => {
      const label = c.name ?? c.context ?? "";
      const reviewish = /coderabbit|bugbot|review/i.test(label);
      const pending = (c.status ?? c.state ?? "").toUpperCase() === "IN_PROGRESS"
        || (c.status ?? c.state ?? "").toUpperCase() === "QUEUED"
        || (c.status ?? c.state ?? "").toUpperCase() === "PENDING";
      return reviewish && pending;
    })
    .map((c) => c.name ?? c.context ?? "unknown");

  verdict({
    pass: unresolved.length === 0 && pendingReviews.length === 0,
    unresolved_threads: unresolved.length,
    pending_reviews: pendingReviews,
    pr: pr.url,
    note: "",
  });
}

main();
