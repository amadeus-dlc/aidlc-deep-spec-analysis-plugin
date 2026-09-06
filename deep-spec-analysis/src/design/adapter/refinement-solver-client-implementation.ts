import { isObject, type Json } from "@deep-spec-analysis/kernel-infrastructure";
// RefinementSolverClient の実 Gateway 実装。第 2 コンパイラでクエリ計画を組み、
// PROVEN v1 z3 子（verify-smt entry の --smt-child）へ実行させ、生のテキスト
// モデルを decode した型付き判定を返す。クエリゼロは子を起動しない（凍結）。
// attempt 文言は refinement プロファイル：v1 と違い **stderr 末尾を付けない**
// `${runtime}: ${error | exit N}`（unavailable 理由の凍結面）。childHost の
// パス・タイムアウト・ランタイム上書き・作業ディレクトリは entry が注入する。
// 旧 runRefinementChild からの逐語移植。

import { spawnSync } from "node:child_process";
import type { UnitRefinementPlan } from "@deep-spec-analysis/design-domain";
import {
  RefinementCheck,
  RefinementQueryVerdict,
  RefinementQueryVerdictEntry,
  RefinementQueryVerdicts,
} from "@deep-spec-analysis/design-domain";

import type { RefinementSolverClient } from "@deep-spec-analysis/design-usecase";
import { parseSolverChildResults, type SolverChildResult } from "@deep-spec-analysis/kernel-adapter";
import { ErrorMessage, QueryLabel } from "@deep-spec-analysis/kernel-domain";
import type { RefinementChildQuery } from "./refinement-child-query.ts";
import { buildRefinementQueries, decodeDesignModel } from "./refinement-query-plan.ts";
import type { RefinementSolverClientConfiguration } from "./refinement-solver-client-configuration.ts";

export class RefinementSolverClientImplementation implements RefinementSolverClient {
  readonly #config: RefinementSolverClientConfiguration;

  constructor(config: RefinementSolverClientConfiguration) {
    this.#config = config;
  }

  check(plan: UnitRefinementPlan, budgetMs: number): RefinementCheck {
    const built = buildRefinementQueries(plan);
    if (built.queries.length === 0) {
      return RefinementCheck.noQueries(built.plan);
    }
    const child = this.#runChild(built.queries, budgetMs);
    if (child.results === null) {
      const reason = ErrorMessage.parse(child.unavailable ?? "z3 unavailable");
      return RefinementCheck.unavailable(
        built.plan,
        reason.ok ? reason.value : ErrorMessage.of("z3 child reported an invalid unavailable reason"),
      );
    }
    const verdicts: RefinementQueryVerdictEntry[] = [];
    for (const [queryId, r] of child.results) {
      const label = QueryLabel.parse(queryId);
      if (!label.ok)
        return RefinementCheck.unavailable(
          built.plan,
          ErrorMessage.of(`invalid solver query label: ${JSON.stringify(label.error)}`),
        );
      const verdict = RefinementQueryVerdict.parse({
        status: r.status,
        decodedModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, false) : undefined,
        decodedPostModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, true) : undefined,
        core: r.core,
      });
      if (!verdict.ok)
        return RefinementCheck.unavailable(
          built.plan,
          ErrorMessage.of(`invalid solver verdict: ${JSON.stringify(verdict.error)}`),
        );
      verdicts.push(RefinementQueryVerdictEntry.of(label.value, verdict.value));
    }
    const collected = RefinementQueryVerdicts.parse(verdicts);
    if (!collected.ok)
      return RefinementCheck.unavailable(
        built.plan,
        ErrorMessage.of(`invalid solver verdict collection: ${JSON.stringify(collected.error)}`),
      );
    return RefinementCheck.solved(built.plan, collected.value);
  }

  #runChild(
    queries: RefinementChildQuery[],
    budgetMs: number,
  ): { results: Map<string, SolverChildResult> | null; unavailable: string | null } {
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
      if (res.error && (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        // タイムアウトは別ランタイムで解け直す見込みがなく、次の試行が呼び手の
        // 予算を二重に燃やす（30s 予算に対し最悪 ~90s）——ここで打ち切る
        //（凍結解除 #38 項 2。ENOENT だけが「次を試す」に値する）。
        attempts.push(`${runtime}: ${String(res.error)}`);
        break;
      }
      if (res.error || res.status !== 0) {
        attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}`);
        continue;
      }
      let parsed: Json;
      try {
        parsed = JSON.parse((res.stdout ?? "").trim().split("\n").pop() ?? "") as Json;
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
        continue;
      }
      if (isObject(parsed) && typeof parsed.unavailable === "string")
        return { results: null, unavailable: parsed.unavailable };
      const validated = parseSolverChildResults(
        parsed,
        queries.map((query) => query.id),
      );
      if (!validated.ok) {
        attempts.push(`${runtime}: ${validated.error}`);
        continue;
      }
      return { results: validated.value, unavailable: null };
    }
    return { results: null, unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
