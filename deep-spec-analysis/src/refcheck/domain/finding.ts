import { type FrRefs, type TargetIds, FindingKind, UnitName } from "@deep-spec/kernel-domain";
import { type WitnessRefs } from "./witness-refs.ts";

// refcheck finding（無沈黙台帳の 1 行）——kind・要件参照・対象・witness ref
// 列・任意の帰属ユニット・説明。契約2 の正準順の材料面（kind 順位表は
// Findings が所有する）は記録自身の知識（#71 波18）。kind は分類文字列、
// detail は prose（裁定の恒久除外）。
export class Finding {
  readonly #kind: FindingKind;
  readonly #frRefs: FrRefs;
  readonly #targets: TargetIds;
  readonly #witness: WitnessRefs;
  readonly #unit: UnitName | undefined;
  readonly #detail: string;

  private constructor(props: { kind: string; frRefs: FrRefs; targets: TargetIds; witness: { refs: WitnessRefs }; unit?: string; detail: string }) {
    this.#kind = FindingKind.reconstitute(props.kind);
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness.refs;
    this.#unit = props.unit === undefined ? undefined : UnitName.reconstitute(props.unit);
    this.#detail = props.detail;
  }

  static reconstitute(props: { kind: string; frRefs: FrRefs; targets: TargetIds; witness: { refs: WitnessRefs }; unit?: string; detail: string }): Finding {
    return new Finding(props);
  }

  kind(): string {
    return this.#kind.asString();
  }

  frRefs(): FrRefs {
    return this.#frRefs;
  }

  targets(): TargetIds {
    return this.#targets;
  }

  witnessRefs(): WitnessRefs {
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
