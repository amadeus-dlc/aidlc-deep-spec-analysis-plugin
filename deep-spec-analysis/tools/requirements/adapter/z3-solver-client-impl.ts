// Z3SolverClient の実 Gateway 実装。計画を組み、自分自身のエントリ
// （--smt-child）を node 優先・bun フォールバックで spawn して解かせ、
// 生のテキストモデルを decode した型付き判定を返す。selfPath・タイムアウト・
// ランタイム上書き・作業ディレクトリは entry が環境から注入する
// （process.* は entry 限定のため）。attempt 文言（v1 プロファイル：stderr
// 200 字尾つき）は unavailable 理由として文書に載る凍結面。
// 旧 runChild からの逐語移植。

import { spawnSync } from "node:child_process";
import { SmtQueryVerdicts } from "../domain/index.ts";
import type { RequirementsModel, SmtQueryVerdict } from "../domain/index.ts";
import type { SmtCheck, Z3SolverClient } from "../usecase/index.ts";
import { type SmtChildQuery, buildSmtPlan, decodeSolverModel } from "./smt-plan-builder.ts";
import type { SmtChildResult } from "./z3-engine-child.ts";

const CHILD_BUDGET_MS = 45_000;
const CHILD_WALL_TIMEOUT_MS = 55_000;

export interface Z3SolverClientConfig {
  readonly selfPath: string;
  readonly perQueryTimeoutMs: number;
  readonly runtimeOverride: string | undefined;
  readonly workingDirectory: string;
}

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
        facts: plan.facts,
        result: { kind: "unavailable", reason: outcome.unavailable ?? "solver child produced no results" },
      };
    }
    const verdicts = new Map<string, SmtQueryVerdict>();
    for (const [id, r] of outcome.results) {
      verdicts.set(id, {
        status: r.status,
        decodedModel: r.status === "sat" ? decodeSolverModel(model, r.model ?? {}) : undefined,
        core: r.core,
      });
    }
    return { facts: plan.facts, result: { kind: "solved", verdicts: SmtQueryVerdicts.of(verdicts) } };
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
