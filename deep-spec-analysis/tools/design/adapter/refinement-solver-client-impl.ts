// RefinementSolverClient の実 Gateway 実装。第 2 コンパイラでクエリ計画を組み、
// PROVEN v1 z3 子（verify-smt entry の --smt-child）へ実行させ、生のテキスト
// モデルを decode した型付き判定を返す。クエリゼロは子を起動しない（凍結）。
// attempt 文言は refinement プロファイル：v1 と違い **stderr 末尾を付けない**
// `${runtime}: ${error | exit N}`（unavailable 理由の凍結面）。childHost の
// パス・タイムアウト・ランタイム上書き・作業ディレクトリは entry が注入する。
// 旧 runRefinementChild からの逐語移植。

import { spawnSync } from "node:child_process";
import { RefinementQueryVerdicts } from "../../refinement/domain/index.ts";
import type {
  RefinementQueryVerdict,
  RefinementRequirements,
  UnitRefinementPlan,
} from "../../refinement/domain/index.ts";
import type { DesignUnit } from "../domain/index.ts";
import type { RefinementCheck, RefinementSolverClient } from "../usecase/index.ts";
import { type RefinementChildQuery } from "./refinement-child-query.ts";
import { buildRefinementQueries, decodeDesignModel } from "./refinement-query-plan.ts";
import type { RefinementSolverClientConfig } from "./refinement-solver-client-config.ts";

interface RefinementChildResult {
  id: string;
  status: "sat" | "unsat" | "unknown" | "budget" | "error";
  model?: { [name: string]: string };
  core?: string[];
  error?: string;
}


export class RefinementSolverClientImpl implements RefinementSolverClient {
  readonly #config: RefinementSolverClientConfig;

  constructor(config: RefinementSolverClientConfig) {
    this.#config = config;
  }

  check(unit: DesignUnit, requirements: RefinementRequirements, plan: UnitRefinementPlan, budgetMs: number): RefinementCheck {
    const built = buildRefinementQueries(unit, requirements, plan);
    if (built.queries.length === 0) {
      return { facts: built.facts, result: { kind: "no-queries" } };
    }
    const child = this.#runChild(built.queries, budgetMs);
    if (child.results === null) {
      return { facts: built.facts, result: { kind: "unavailable", reason: child.unavailable ?? "z3 unavailable" } };
    }
    const verdicts = new Map<string, RefinementQueryVerdict>();
    for (const [queryId, r] of child.results) {
      verdicts.set(queryId, {
        status: r.status,
        decodedModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, false) : undefined,
        decodedPostModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, true) : undefined,
        core: r.core,
      });
    }
    return { facts: built.facts, result: { kind: "solved", verdicts: RefinementQueryVerdicts.of(verdicts) } };
  }

  #runChild(queries: RefinementChildQuery[], budgetMs: number): { results: Map<string, RefinementChildResult> | null; unavailable: string | null } {
    const payload = JSON.stringify({ queries, timeoutMs: this.#config.perQueryTimeoutMs, budgetMs });
    const runtimes = this.#config.runtimeOverride ? [this.#config.runtimeOverride] : ["node", "bun"];
    const attempts: string[] = [];
    for (const runtime of runtimes) {
      const res = spawnSync(runtime, [this.#config.childHostPath, "--smt-child"], {
        input: payload,
        encoding: "utf-8",
        timeout: budgetMs + 15_000,
        cwd: this.#config.workingDirectory,
      });
      if (res.error && (res.error as NodeJS.ErrnoException).code === "ENOENT") {
        attempts.push(`${runtime}: not on PATH`);
        continue;
      }
      if (res.error || res.status !== 0) {
        attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}`);
        continue;
      }
      try {
        const parsed = JSON.parse((res.stdout ?? "").trim().split("\n").pop() ?? "");
        if (typeof parsed.unavailable === "string") return { results: null, unavailable: parsed.unavailable };
        const map = new Map<string, RefinementChildResult>();
        for (const r of parsed.results ?? []) map.set(r.id, r);
        return { results: map, unavailable: null };
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
      }
    }
    return { results: null, unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
