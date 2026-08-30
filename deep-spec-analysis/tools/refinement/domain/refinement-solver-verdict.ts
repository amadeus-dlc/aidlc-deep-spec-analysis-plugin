// refinement ソルバ実行の型付き判定と計画事実。SMT-LIB スクリプト・z3 の生
// 表現はアダプタ（第 2 コンパイラ＋クライアント）が持ち、ドメインへは
// クエリ id（"rv:OB-x" / "re:OB-x" / "rs2:OB-x:TR-y" / "rs:SC-x"）ごとの
// 判定と、その id が何の検査だったか（Pending）だけが届く。decoded モデルは
// pre / post（primed）の両状態。判定の解釈（4 種の検査 → findings / skips、
// detail 文言は golden 凍結）は facts 自身の振る舞い（OOUI 裁定——旧
// interpretRefinementVerdicts の逐語移植）。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import { DesignFindings, DesignSkips } from "../../design/domain/index.ts";
import type { DesignFinding, DesignSkipped, DesignValue } from "../../design/domain/index.ts";
import type { UnitRefinementPlan } from "./refinement-plan.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

export interface RefinementProbe {
  kind: "invariant" | "scenario" | "enabledness" | "simulation";
  reqId: string;
  designId?: string;
}

export type RefinementQueryStatus = "sat" | "unsat" | "unknown" | "budget" | "error";

export interface RefinementQueryVerdict {
  readonly status: RefinementQueryStatus;
  readonly decodedModel?: { [path: string]: DesignValue };
  readonly decodedPostModel?: { [path: string]: DesignValue };
  readonly core?: string[];
}

// クエリ id → 判定のファーストクラスな判定面。
export class RefinementQueryVerdicts {
  readonly #values: ReadonlyMap<string, RefinementQueryVerdict>;

  private constructor(values: ReadonlyMap<string, RefinementQueryVerdict>) {
    this.#values = values;
  }

  static of(values: ReadonlyMap<string, RefinementQueryVerdict>): RefinementQueryVerdicts {
    return new RefinementQueryVerdicts(new Map(values));
  }

  verdictOf(queryId: string): RefinementQueryVerdict | undefined {
    return this.#values.get(queryId);
  }
}

export interface InterpretedRefinementVerdicts {
  findings: DesignFindings;
  skipped: DesignSkips;
}

// クエリ計画の事実：発行順の Pending 索引と、alpha 置換・SMT コンパイル失敗
// による compile-error skip（構築時に確定）。
export class RefinementSolverFacts {
  readonly #pending: ReadonlyMap<string, RefinementProbe>;
  readonly #compileSkips: DesignSkips;

  private constructor(props: { pending: ReadonlyMap<string, RefinementProbe>; compileSkips: DesignSkips }) {
    this.#pending = props.pending;
    this.#compileSkips = props.compileSkips;
  }

  static of(props: { pending: ReadonlyMap<string, RefinementProbe>; compileSkips: DesignSkips }): RefinementSolverFacts {
    return new RefinementSolverFacts({ pending: new Map(props.pending), compileSkips: props.compileSkips });
  }

  compileSkips(): DesignSkips {
    return this.#compileSkips;
  }

  // 発行順の Pending 走査（timeout skip の記録順——最終文書は compose が
  // 正準ソートする）。
  *[Symbol.iterator](): Iterator<readonly [string, RefinementProbe]> {
    yield* this.#pending.entries();
  }

  // 旧 interpretRefinementVerdicts の逐語移植。
  interpret(
    results: RefinementQueryVerdicts,
    req: RefinementRequirements,
    plan: UnitRefinementPlan,
    unitName: string,
  ): InterpretedRefinementVerdicts {
    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const frOf = (reqId: string): string[] => sortedUnique(req.frRefsOf(reqId), idCompare);

    for (const [queryId, p] of this.#pending) {
      const r = results.verdictOf(queryId);
      if (!r || r.status === "unknown" || r.status === "budget" || r.status === "error") {
        skipped.push({ target: p.reqId, reason: "timeout", unit: unitName, detail: `refinement query ${queryId} exceeded the solver budget or errored` });
        continue;
      }
      if (p.kind === "invariant") {
        if (r.status === "sat") {
          findings.push({
            kind: "refinement-violation",
            frRefs: frOf(p.reqId),
            targets: [p.reqId],
            witness: { model: r.decodedModel ?? {} },
            unit: unitName,
            detail: `A design-legal state of unit ${unitName} violates requirements obligation ${p.reqId} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`,
          });
        }
      } else if (p.kind === "scenario") {
        const sc = req.scenarioById(p.reqId);
        if (sc?.kind === "accept" && r.status === "unsat") {
          findings.push({
            kind: "refinement-violation",
            frRefs: frOf(p.reqId),
            targets: [p.reqId],
            witness: { core: [...(r.core ?? [])].sort() },
            unit: unitName,
            detail: `Accept scenario ${p.reqId} has no design-legal counterpart in unit ${unitName} under the refinement map: the design excludes an example the requirements accept (witness core attached).`,
          });
        }
        if (sc?.kind === "reject" && r.status === "sat") {
          findings.push({
            kind: "refinement-violation",
            frRefs: frOf(p.reqId),
            targets: [p.reqId],
            witness: { model: r.decodedModel ?? {} },
            unit: unitName,
            detail: `Reject scenario ${p.reqId} is still admitted by unit ${unitName} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`,
          });
        }
      } else if (p.kind === "enabledness") {
        if (r.status === "sat") {
          findings.push({
            kind: "completeness-gap",
            frRefs: frOf(p.reqId),
            targets: sortedUnique([p.reqId, ...plan.mappedTransitionsOf(p.reqId)], idCompare),
            witness: { model: r.decodedModel ?? {} },
            unit: unitName,
            detail: `The requirements event ${p.reqId} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`,
          });
        }
      } else if (p.kind === "simulation") {
        if (r.status === "sat") {
          findings.push({
            kind: "refinement-violation",
            frRefs: frOf(p.reqId),
            targets: sortedUnique([p.reqId, p.designId ?? ""], idCompare).filter((t) => t !== ""),
            witness: { trace: [r.decodedModel ?? {}, r.decodedPostModel ?? {}] },
            unit: unitName,
            detail: `Design step ${p.designId} of unit ${unitName}, taken where requirements event ${p.reqId} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`,
          });
        }
      }
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped) };
  }
}
