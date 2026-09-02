import type { TargetId } from "../../kernel/domain/index.ts";

// 設計検証の skip（契約2 の設計版）——対象・理由・帰属ユニット・任意の説明。
// 正準順（unit → target → reason）と「その対象の skip か」の判定は記録自身の
// 知識（#71 波17）。reason は分類文字列、detail は prose（裁定の恒久除外）。
export class DesignSkipped {
  readonly #target: TargetId;
  readonly #reason: string;
  readonly #unit: string;
  readonly #detail: string | undefined;

  private constructor(props: { target: TargetId; reason: string; unit: string; detail?: string }) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }

  static reconstitute(props: { target: TargetId; reason: string; unit: string; detail?: string }): DesignSkipped {
    return new DesignSkipped(props);
  }

  target(): TargetId {
    return this.#target;
  }

  reason(): string {
    return this.#reason;
  }

  unit(): string {
    return this.#unit;
  }

  detail(): string | undefined {
    return this.#detail;
  }

  isFor(target: TargetId): boolean {
    return this.#target.equals(target);
  }

  // 正準順: unit の辞書順、次いで target の id 順、次いで reason の辞書順。
  compareTo(other: DesignSkipped): number {
    if (this.#unit !== other.#unit) return this.#unit < other.#unit ? -1 : 1;
    const c = this.#target.compareTo(other.#target);
    if (c !== 0) return c;
    return this.#reason < other.#reason ? -1 : this.#reason > other.#reason ? 1 : 0;
  }
}
