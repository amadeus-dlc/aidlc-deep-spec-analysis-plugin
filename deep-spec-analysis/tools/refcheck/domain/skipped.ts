import { TargetId, UnitName } from "../../kernel/domain/index.ts";

// refcheck skip 記録（無沈黙台帳の 1 行）——対象・理由・任意の帰属ユニットと
// 説明。正準順（target → reason）は記録自身の知識（#71 波17）。target は
// 名前空間付きトークン（`check:…` 等——refcheck 台帳の材料面、生 string の
// まま）、reason は分類文字列、detail は prose（裁定の恒久除外）。
export class Skipped {
  readonly #target: TargetId;
  readonly #reason: string;
  readonly #unit: UnitName | undefined;
  readonly #detail: string | undefined;

  private constructor(props: { target: string; reason: string; unit?: string; detail?: string }) {
    this.#target = TargetId.reconstitute(props.target);
    this.#reason = props.reason;
    this.#unit = props.unit === undefined ? undefined : UnitName.reconstitute(props.unit);
    this.#detail = props.detail;
  }

  static reconstitute(props: { target: string; reason: string; unit?: string; detail?: string }): Skipped {
    return new Skipped(props);
  }

  target(): string {
    return this.#target.asString();
  }

  reason(): string {
    return this.#reason;
  }

  unit(): string | undefined {
    return this.#unit?.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }

  // 正準順: target の id 順、次いで reason の辞書順。
  compareTo(other: Skipped): number {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0) return c;
    return this.#reason < other.#reason ? -1 : this.#reason > other.#reason ? 1 : 0;
  }
}
