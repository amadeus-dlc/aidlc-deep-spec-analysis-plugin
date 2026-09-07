import type { SkipReason, TargetIdentifier, UnitName } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfNullable, hashOfString, type Json } from "@deep-spec-analysis/kernel-infrastructure";

// refcheck skip 記録（無沈黙台帳の 1 行）——対象・理由・任意の帰属ユニットと
// 説明。正準順（target → reason）は記録自身の知識（#71 波17）。target は
// 名前空間付きトークン（`check:…` 等——refcheck 台帳の材料面、生 string の
// まま）、reason は分類文字列、detail は prose（裁定の恒久除外）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SkippedParam = { target: TargetIdentifier; reason: SkipReason; unit?: UnitName; detail?: string };

export class Skipped {
  readonly #target: TargetIdentifier;
  readonly #reason: SkipReason;
  readonly #unit: UnitName | undefined;
  readonly #detail: string | undefined;

  private constructor(props: SkippedParam) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }

  static of(props: SkippedParam): Skipped {
    return new Skipped(props);
  }

  target(): string {
    return this.#target.asString();
  }

  reason(): string {
    return this.#reason.asString();
  }

  unit(): string | undefined {
    return this.#unit?.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }

  equals(other: Skipped): boolean {
    return (
      this.#target.equals(other.#target) &&
      this.#reason.asString() === other.#reason.asString() &&
      (this.#unit === undefined
        ? other.#unit === undefined
        : other.#unit !== undefined && this.#unit.equals(other.#unit)) &&
      this.#detail === other.#detail
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#target.hashCode(),
      hashOfString(this.#reason.asString()),
      hashOfNullable(this.#unit, (unit) => unit.hashCode()),
      hashOfNullable(this.#detail, hashOfString),
    ]);
  }

  // 境界: 描画専用。キー順 (target, reason, detail?, unit?) は契約2 の凍結形。
  toDocument(): { [k: string]: Json } {
    const out: { [k: string]: Json } = { target: this.#target.asString(), reason: this.#reason.asString() };
    if (this.#detail !== undefined) out.detail = this.#detail;
    const unit = this.#unit?.asString();
    if (unit !== undefined) out.unit = unit;
    return out;
  }

  // 正準順: target の id 順、次いで reason の辞書順。
  compareTo(other: Skipped): number {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0) return c;
    return this.#reason.compareTo(other.#reason);
  }
}
