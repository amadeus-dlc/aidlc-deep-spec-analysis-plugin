import {
  FindingKind,
  FindingTargets,
  type FunctionalRequirementReferences,
  SkipReason,
  TargetIdentifier,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { type ParseError, traverseResult } from "@deep-spec-analysis/kernel-infrastructure";
import { DesignFinding } from "./design-finding.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignWitness } from "./design-witness.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";
import type { LoweringIndex } from "./lowering-index.ts";
import { RuleSubsumption } from "./rule-subsumption.ts";
import { RuleSubsumptionVerdict } from "./rule-subsumption-verdict.ts";

// 兄弟バックエンドが返した finding 1 件——lowering 側の id で書かれている。
// 判定の再割り当て（SiblingVerdictDocument.remapVerdicts）は種類を問い、対象を写像し、
// witness の core 形を finding 自身に書き換えさせる（#71 波23）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SiblingVerdictFindingParam = {
  kind: FindingKind;
  functionalRequirementReferences: FunctionalRequirementReferences;
  targets: readonly LoweredIdentifier[];
  witness: DesignWitness;
  detail: string;
};

export class SiblingVerdictFinding {
  readonly #kind: FindingKind;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #targets: readonly LoweredIdentifier[];
  readonly #witness: DesignWitness;
  readonly #detail: string;

  private constructor(props: SiblingVerdictFindingParam) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = Object.freeze([...props.targets]);
    this.#witness = props.witness;
    this.#detail = props.detail;
  }

  static of(props: SiblingVerdictFindingParam): SiblingVerdictFinding {
    return new SiblingVerdictFinding(props);
  }

  remap(
    unit: UnitName,
    index: LoweringIndex,
  ):
    | { kind: "finding"; finding: DesignFinding }
    | { kind: "unreachable"; finding: DesignFinding; target: TargetIdentifier }
    | { kind: "subsumption"; relation: RuleSubsumption }
    | { kind: "waived"; skipped: DesignSkips }
    | { kind: "ignored" }
    | { kind: "invalid"; error: ParseError } {
    const resolved = traverseResult(this.#targets, (target) => index.resolveDesignTarget(target));
    if (!resolved.ok) return { kind: "invalid", error: resolved.error };
    const mapped = resolved.value;
    const witness = this.witnessRemappedBy((label) => index.rewriteLoweredIdTokens(label));
    const synthetic = mapped.find((target) => target.entry?.isSyntheticProbe());
    if (synthetic?.entry?.isKind("vac-dead") && this.isKind("conflict")) {
      const design = synthetic.entry.design().asString();
      const target = TargetIdentifier.of(design);
      return {
        kind: "unreachable",
        target,
        finding: DesignFinding.of({
          kind: FindingKind.unreachable(),
          functionalRequirementReferences: this.#functionalRequirementReferences,
          targets: FindingTargets.of(target, []),
          witness,
          unit,
          detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${index.isTransition(design) ? "transition" : "rule"} is dead.`,
        }),
      };
    }
    const probe = synthetic?.entry?.subsumptionProbe();
    if (probe != null) {
      const relation = RuleSubsumption.parse(RuleSubsumptionVerdict.fromFinding(probe, this, witness, unit));
      return relation.ok ? { kind: "subsumption", relation: relation.value } : { kind: "ignored" };
    }
    if (synthetic !== undefined) return { kind: "ignored" };
    const [head, ...tail] = mapped.map((target) => TargetIdentifier.of(target.design.asString()));
    if (head === undefined) return { kind: "invalid", error: { kind: "empty-finding-targets" } };
    const parsedTargets = FindingTargets.parse(head, tail);
    if (!parsedTargets.ok) return { kind: "invalid", error: parsedTargets.error };
    const targets = parsedTargets.value.sortedUniqueCanonically();
    if (this.isKind("conflict")) {
      const machines = [...targets].map((target) => index.machineOfTransition(target.asString()));
      const machine = machines[0];
      if (machine?.waivesOverlapOf(machines))
        return {
          kind: "waived",
          skipped: DesignSkips.of(
            [...targets].map((target) =>
              DesignSkipped.of({
                target,
                reason: SkipReason.waived(),
                unit,
                detail: `machine ${machine.id().asString()} declares deterministic: false — the same-(state,trigger) overlap check is waived by the model`,
              }),
            ),
          ),
        };
    }
    return {
      kind: "finding",
      finding: DesignFinding.of({
        kind: this.#kind,
        functionalRequirementReferences: this.#functionalRequirementReferences,
        targets,
        witness,
        unit,
        detail: index.rewriteLoweredIds(this.#detail),
      }),
    };
  }

  kind(): string {
    return this.#kind.asString();
  }

  // 呼び手はすべてこのファイルの外の domain 判定ロジックが持つ既知の閉集合
  // リテラル（"conflict" 等）——parse の閉集合の門を通す（種別規律の裁定
  // 3-2、2026-09-04）。未知の literal は defect であって finding の #kind とは
  // 決して一致しない。
  isKind(kind: string): boolean {
    const parsed = FindingKind.parse(kind);
    return parsed.ok && this.#kind.equals(parsed.value);
  }

  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }

  targets(): readonly LoweredIdentifier[] {
    return this.#targets;
  }

  detail(): string {
    return this.#detail;
  }

  provesReachabilityOf(attrPath: string, state: string): boolean {
    return this.isKind("conflict") && this.#witness.reachesState(attrPath, state);
  }

  // core のラベル（lowered id）を design id へ書き換えた witness——形の判定は
  // witness 自身が行う（裁定 2、2026-09-03）。
  witnessRemappedBy(rewrite: (label: string) => string): DesignWitness {
    return this.#witness.remapCore(rewrite);
  }
}
