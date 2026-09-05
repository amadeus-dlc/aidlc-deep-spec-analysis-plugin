// 設計検証 finding / skip の語彙（契約2 拡張——unit 帰属つき）。witness は
// v1 判定から remap で受け継ぐ素通し値（core は remap 済みラベル列、trace /
// model / verdicts はそのまま）。conflict 判定の refinement 再解釈（対象が
// 要件 id に届く conflict は refinement-violation へ昇格する——文言は凍結）
// は finding 自身が所有する（#71 波7）。

import {
  FindingKind,
  type FunctionalRequirementReferences,
  TargetIdentifiers,
  type UnitName,
} from "@deep-spec/kernel-domain";
import type { DesignWitness } from "./design-witness.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignFindingParam = {
  kind: FindingKind;
  functionalRequirementReferences: FunctionalRequirementReferences;
  targets: TargetIdentifiers;
  witness: DesignWitness;
  unit: UnitName;
  detail: string;
};

export class DesignFinding {
  readonly #kind: FindingKind;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #targets: TargetIdentifiers;
  readonly #witness: DesignWitness;
  readonly #unit: UnitName;
  readonly #detail: string;

  private constructor(props: DesignFindingParam) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }

  // 正常生成（strict creation）——検証済みの FindingKind だけを受け取る。
  // domain／usecase が自ら下す判定はこの口を通る（FR3.2）。
  static of(props: DesignFindingParam): DesignFinding {
    return new DesignFinding(props);
  }

  kind(): string {
    return this.#kind.asString();
  }

  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }

  targets(): TargetIdentifiers {
    return this.#targets;
  }

  witness(): DesignWitness {
    return this.#witness;
  }

  unit(): string {
    return this.#unit.asString();
  }

  detail(): string {
    return this.#detail;
  }

  isConflict(): boolean {
    return this.#kind.isConflict();
  }

  // conflict 判定の refinement 再解釈：対象が追加不変量の要件 id に届くなら
  // refinement-violation へ昇格する（文言は golden 凍結）。conflict でないか
  // 要件 id に届かないときは null——後者は設計自身の conflict で、呼び手は
  // masked skip の勘定へ回す。
  asRefinementViolation(reqIds: ReadonlySet<string>, unit: UnitName): DesignFinding | null {
    if (!this.#kind.isConflict()) return null;
    const reqHits = this.#targets.toArray().filter((t) => reqIds.has(t.asString()));
    if (reqHits.length === 0) return null;
    return new DesignFinding({
      kind: FindingKind.refinementViolation(),
      functionalRequirementReferences: this.#functionalRequirementReferences,
      targets: TargetIdentifiers.of(reqHits),
      witness: this.#witness,
      unit,
      detail: `The design machine of unit ${unit.asString()} reaches a state that violates requirements obligation ${reqHits.map((t) => t.asString()).join(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`,
    });
  }

  // 文言だけを差し替えた複製（相互包摂の畳み込み——凍結面は detail のみ）。
  // 正準順の材料: kind 順位（kernel の FindingKind）。unit → targets → detail の
  // tiebreak はコレクションが持つ。
  compareKindTo(other: DesignFinding): number {
    return this.#kind.compareTo(other.#kind);
  }

  withDetail(detail: string): DesignFinding {
    return new DesignFinding({
      kind: this.#kind,
      functionalRequirementReferences: this.#functionalRequirementReferences,
      targets: this.#targets,
      witness: this.#witness,
      unit: this.#unit,
      detail,
    });
  }
}
