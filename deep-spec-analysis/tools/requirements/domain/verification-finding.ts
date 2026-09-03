import { type FrRefs, type TargetId, type TargetIds, FindingKind } from "../../kernel/domain/index.ts";
import type { VerificationWitness } from "./verification-witness.ts";

// v1 検証 finding（契約2）——kind・要件参照・対象・witness・説明。契約2 の
// 正準順（kind 順位 → targets の結合キー → detail）の材料面（順位表は
// VerificationFindings が所有する）と「その対象を含むか」の判定は記録自身の
// 知識（#71 波18）。kind は分類文字列、detail は prose（裁定の恒久除外）。
// witness は型付きユニオン——unsat core のラベル列・decode 済み状態モデル・
// クロスチェック判定表・状態機械のステップトレース。
export class VerificationFinding {
  readonly #kind: FindingKind;
  readonly #frRefs: FrRefs;
  readonly #targets: TargetIds;
  readonly #witness: VerificationWitness;
  readonly #detail: string;

  private constructor(props: { kind: string; frRefs: FrRefs; targets: TargetIds; witness: VerificationWitness; detail: string }) {
    this.#kind = FindingKind.reconstitute(props.kind);
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }

  static reconstitute(props: { kind: string; frRefs: FrRefs; targets: TargetIds; witness: VerificationWitness; detail: string }): VerificationFinding {
    return new VerificationFinding(props);
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

  witness(): VerificationWitness {
    return this.#witness;
  }

  detail(): string {
    return this.#detail;
  }

  isKind(kind: string): boolean {
    return this.#kind.equals(FindingKind.reconstitute(kind));
  }

  implicates(target: TargetId): boolean {
    return this.#targets.includes(target);
  }

  // 正準順の材料: kind 順位は所有者（コレクション）が引き、同順位なら targets の
  // 結合キー、次いで detail の辞書順。
  compareTo(other: VerificationFinding): number {
    const kr = this.#kind.compareTo(other.#kind);
    if (kr !== 0) return kr;
    const ta = this.#targets.joined(",");
    const tb = other.#targets.joined(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return this.#detail < other.#detail ? -1 : this.#detail > other.#detail ? 1 : 0;
  }
}
