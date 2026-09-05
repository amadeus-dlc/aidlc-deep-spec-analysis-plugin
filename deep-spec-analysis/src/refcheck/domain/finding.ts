import { type FunctionalRequirementReferences, type TargetIdentifiers, FindingKind, UnitName } from "@deep-spec/kernel-domain";
import { type WitnessReferences } from "./witness-references.ts";

// refcheck finding（無沈黙台帳の 1 行）——kind・要件参照・対象・witness ref
// 列・任意の帰属ユニット・説明。契約2 の正準順の材料面（kind 順位表は
// Findings が所有する）は記録自身の知識（#71 波18）。kind は分類文字列、
// detail は prose（裁定の恒久除外）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type FindingParam = { kind: FindingKind; functionalRequirementReferences: FunctionalRequirementReferences; targets: TargetIdentifiers; witness: { refs: WitnessReferences }; unit?: UnitName; detail: string };

export class Finding {
  readonly #kind: FindingKind;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #targets: TargetIdentifiers;
  readonly #witness: WitnessReferences;
  readonly #unit: UnitName | undefined;
  readonly #detail: string;

  private constructor(props: FindingParam) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = props.targets;
    this.#witness = props.witness.refs;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }

  // 正常生成（strict creation）——検証済みの FindingKind だけを受け取る。
  // 検査が自ら下す判定はこの口を通る（FR3.2）。
  static of(props: FindingParam): Finding {
    return new Finding(props);
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

  witnessRefs(): WitnessReferences {
    return this.#witness;
  }

  unit(): string | undefined {
    return this.#unit?.asString();
  }

  detail(): string {
    return this.#detail;
  }

  // 正準順の材料: kind 順位は所有者（コレクション）が引き、同順位なら targets の
  // 結合キー、次いで detail の辞書順。
  compareTo(other: Finding): number {
    const kr = this.#kind.compareTo(other.#kind);
    if (kr !== 0) return kr;
    const ta = this.#targets.joined(",");
    const tb = other.#targets.joined(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return this.#detail < other.#detail ? -1 : this.#detail > other.#detail ? 1 : 0;
  }
}
