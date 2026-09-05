import {
  FindingKind,
  type FunctionalRequirementReferences,
  type TargetIdentifier,
  type TargetIdentifiers,
} from "@deep-spec/kernel-domain";
import type { VerificationWitness } from "./verification-witness.ts";

// v1 検証 finding（契約2）——kind・要件参照・対象・witness・説明。契約2 の
// 正準順（kind 順位 → targets の結合キー → detail）の材料面（順位表は
// VerificationFindings が所有する）と「その対象を含むか」の判定は記録自身の
// 知識（#71 波18）。kind は分類文字列、detail は prose（裁定の恒久除外）。
// witness は型付きユニオン——unsat core のラベル列・decode 済み状態モデル・
// クロスチェック判定表・状態機械のステップトレース。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type VerificationFindingParam = {
  kind: FindingKind;
  functionalRequirementReferences: FunctionalRequirementReferences;
  targets: TargetIdentifiers;
  witness: VerificationWitness;
  detail: string;
};

export class VerificationFinding {
  readonly #kind: FindingKind;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #targets: TargetIdentifiers;
  readonly #witness: VerificationWitness;
  readonly #detail: string;

  private constructor(props: VerificationFindingParam) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }

  // 正常生成（strict creation）——検証済みの FindingKind だけを受け取る。
  // domain／usecase が自ら下す判定はこの口を通る（FR3.2）。
  static of(props: VerificationFindingParam): VerificationFinding {
    return new VerificationFinding(props);
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

  witness(): VerificationWitness {
    return this.#witness;
  }

  detail(): string {
    return this.#detail;
  }

  // 呼び手はすべて domain 判定ロジックが持つ既知の閉集合リテラル
  // （"scenario-violation" 等）——parse の閉集合の門を通す（種別規律の裁定
  // 3-2、2026-09-04）。未知の literal は defect であって finding の #kind とは
  // 決して一致しない。
  isKind(kind: string): boolean {
    const parsed = FindingKind.parse(kind);
    return parsed.ok && this.#kind.equals(parsed.value);
  }

  implicates(target: TargetIdentifier): boolean {
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
