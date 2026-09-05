import { combineResults, traverseResult, ok } from "@deep-spec/kernel-infrastructure";
// Z3SolverClient の実 Gateway 実装。計画を組み、自分自身のエントリ
// （--smt-child）を node 優先・bun フォールバックで spawn して解かせ、
// 生のテキストモデルを decode した型付き判定を返す。selfPath・タイムアウト・
// ランタイム上書き・作業ディレクトリは entry が環境から注入する
// （process.* は entry 限定のため）。attempt 文言（v1 プロファイル：stderr
// 200 字尾つき）は unavailable 理由として文書に載る凍結面。
// 旧 runChild からの逐語移植。

import { spawnSync } from "node:child_process";
import { SmtQueryVerdicts } from "@deep-spec/requirements-domain";
import { SmtQueryVerdict } from "@deep-spec/requirements-domain";
import type { RequirementsModel } from "@deep-spec/requirements-domain";

import type { SmtCheck, Z3SolverClient } from "@deep-spec/requirements-usecase";
import { type SmtChildQuery } from "./smt-child-query.ts";
import { buildSmtPlan, decodeSolverModel } from "./smt-plan.ts";
import type { SmtChildResult } from "./smt-child-result.ts";
import type { Z3SolverClientConfig } from "./z3-solver-client-config.ts";
import { KeyedIndex, QueryLabel } from "@deep-spec/kernel-domain";

const CHILD_BUDGET_MS = 45_000;
const CHILD_WALL_TIMEOUT_MS = 55_000;

export class Z3SolverClientImpl implements Z3SolverClient {
  readonly #config: Z3SolverClientConfig;

  constructor(config: Z3SolverClientConfig) {
    this.#config = config;
  }

  check(model: RequirementsModel): SmtCheck {
    const plan = buildSmtPlan(model);
    const outcome = this.#runChild(plan.queries);
    if (outcome.unavailable !== undefined || !outcome.results) {
      return {
        plan: plan.plan,
        result: { kind: "unavailable", reason: outcome.unavailable ?? "solver child produced no results" },
      };
    }
    const verdicts: (readonly [QueryLabel, SmtQueryVerdict])[] = [];
    for (const [id, r] of outcome.results) {
      const parsed = combineResults({
        label: QueryLabel.parse(id),
        core: r.core === undefined ? ok(undefined) : traverseResult(r.core, QueryLabel.parse),
      });
      if (!parsed.ok) return { plan: plan.plan, result: { kind: "unavailable", reason: `invalid solver query label: ${JSON.stringify(parsed.error)}` } };
      verdicts.push([parsed.value.label, SmtQueryVerdict.of({
        status: r.status,
        decodedModel: r.status === "sat" ? decodeSolverModel(model, r.model ?? {}) : undefined,
        core: parsed.value.core?.map((label) => label.asString()),
      })]);
    }
    return { plan: plan.plan, result: { kind: "solved", verdicts: SmtQueryVerdicts.of(KeyedIndex.of(verdicts)) } };
  }

  #runChild(queries: SmtChildQuery[]): { results?: Map<string, SmtChildResult>; unavailable?: string } {
    const payload = JSON.stringify({ queries, timeoutMs: this.#config.perQueryTimeoutMs, budgetMs: CHILD_BUDGET_MS });
    const runtimes = this.#config.runtimeOverride ? [this.#config.runtimeOverride] : ["node", "bun"];
    const attempts: string[] = [];
    for (const runtime of runtimes) {
      const res = spawnSync(runtime, [this.#config.selfPath, "--smt-child"], {
        input: payload,
        encoding: "utf-8",
        timeout: CHILD_WALL_TIMEOUT_MS,
        cwd: this.#config.workingDirectory,
      });
      if (res.error && (res.error as NodeJS.ErrnoException).code === "ENOENT") {
        attempts.push(`${runtime}: not on PATH`);
        continue;
      }
      if (res.error || res.status !== 0) {
        const stderrTail = (res.stderr ?? "").trim().split("\n").slice(-2).join(" ").slice(0, 200);
        attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}${stderrTail ? ` (${stderrTail})` : ""}`);
        continue;
      }
      try {
        const parsed = JSON.parse((res.stdout ?? "").trim().split("\n").pop() ?? "");
        if (typeof parsed.unavailable === "string") return { unavailable: parsed.unavailable };
        const map = new Map<string, SmtChildResult>();
        for (const r of parsed.results ?? []) map.set(r.id, r);
        return { results: map };
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
      }
    }
    return { unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
