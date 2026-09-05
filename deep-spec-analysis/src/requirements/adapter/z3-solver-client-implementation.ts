import { combineResults, isObject, type Json, ok, traverseResult } from "@deep-spec/kernel-infrastructure";
import { parseSmtChildResults } from "./smt-child-results-parser.ts";
// Z3SolverClient の実 Gateway 実装。計画を組み、自分自身のエントリ
// （--smt-child）を node 優先・bun フォールバックで spawn して解かせ、
// 生のテキストモデルを decode した型付き判定を返す。selfPath・タイムアウト・
// ランタイム上書き・作業ディレクトリは entry が環境から注入する
// （process.* は entry 限定のため）。attempt 文言（v1 プロファイル：stderr
// 200 字尾つき）は unavailable 理由として文書に載る凍結面。
// 旧 runChild からの逐語移植。

import { spawnSync } from "node:child_process";
import { ErrorMessage, KeyedIndex, QueryLabel } from "@deep-spec/kernel-domain";
import type { RequirementsModel } from "@deep-spec/requirements-domain";
import {
  SatisfiabilityModuloTheoriesCheck,
  SatisfiabilityModuloTheoriesQueryVerdict,
  SatisfiabilityModuloTheoriesQueryVerdicts,
} from "@deep-spec/requirements-domain";
import type { Z3SolverClient } from "@deep-spec/requirements-usecase";
import type { SatisfiabilityModuloTheoriesChildQuery } from "./satisfiability-modulo-theories-child-query.ts";
import type { SatisfiabilityModuloTheoriesChildResult } from "./satisfiability-modulo-theories-child-result.ts";
import { buildSmtPlan, decodeSolverModel } from "./satisfiability-modulo-theories-plan.ts";
import type { Z3SolverClientConfiguration } from "./z3-solver-client-configuration.ts";

const CHILD_BUDGET_MS = 45_000;
const CHILD_WALL_TIMEOUT_MS = 55_000;

export class Z3SolverClientImplementation implements Z3SolverClient {
  readonly #config: Z3SolverClientConfiguration;

  constructor(config: Z3SolverClientConfiguration) {
    this.#config = config;
  }

  check(model: RequirementsModel): SatisfiabilityModuloTheoriesCheck {
    const plan = buildSmtPlan(model);
    const outcome = this.#runChild(plan.queries);
    if (outcome.unavailable !== undefined || !outcome.results) {
      const reason = ErrorMessage.parse(outcome.unavailable ?? "solver child produced no results");
      return SatisfiabilityModuloTheoriesCheck.of({
        plan: plan.plan,
        result: {
          kind: "unavailable",
          reason: reason.ok ? reason.value : ErrorMessage.of("solver child reported an invalid unavailable reason"),
        },
      });
    }
    const verdicts: (readonly [QueryLabel, SatisfiabilityModuloTheoriesQueryVerdict])[] = [];
    for (const [id, r] of outcome.results) {
      const parsed = combineResults({
        label: QueryLabel.parse(id),
        core: r.core === undefined ? ok(undefined) : traverseResult(r.core, QueryLabel.parse),
      });
      if (!parsed.ok)
        return SatisfiabilityModuloTheoriesCheck.of({
          plan: plan.plan,
          result: {
            kind: "unavailable",
            reason: ErrorMessage.of(`invalid solver query label: ${JSON.stringify(parsed.error)}`),
          },
        });
      verdicts.push([
        parsed.value.label,
        SatisfiabilityModuloTheoriesQueryVerdict.of({
          status: r.status,
          decodedModel: r.status === "sat" ? decodeSolverModel(model, r.model ?? {}) : undefined,
          core: parsed.value.core?.map((label) => label.asString()),
        }),
      ]);
    }
    return SatisfiabilityModuloTheoriesCheck.of({
      plan: plan.plan,
      result: { kind: "solved", verdicts: SatisfiabilityModuloTheoriesQueryVerdicts.of(KeyedIndex.of(verdicts)) },
    });
  }

  #runChild(queries: SatisfiabilityModuloTheoriesChildQuery[]): {
    results?: Map<string, SatisfiabilityModuloTheoriesChildResult>;
    unavailable?: string;
  } {
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
        attempts.push(
          `${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}${stderrTail ? ` (${stderrTail})` : ""}`,
        );
        continue;
      }
      let raw: Json;
      try {
        raw = JSON.parse((res.stdout ?? "").trim().split("\n").pop() ?? "");
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
        continue;
      }
      if (isObject(raw) && typeof raw.unavailable === "string") return { unavailable: raw.unavailable };
      const parsed = parseSmtChildResults(
        raw,
        queries.map((query) => query.id),
      );
      if (!parsed.ok) {
        attempts.push(`${runtime}: ${parsed.error}`);
        continue;
      }
      return { results: parsed.value };
    }
    return { unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
