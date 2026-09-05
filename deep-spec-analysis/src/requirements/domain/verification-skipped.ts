import { SkipReason, type TargetId } from "@deep-spec/kernel-domain";

// v1 検証 skip（契約2）——対象・理由・任意の説明。正準順（target → reason）と
// 「その対象の skip か」の判定は記録自身の知識（#71 波17）。reason は分類
// 文字列、detail は prose（裁定の恒久除外）。
export class VerificationSkipped {
  readonly #target: TargetId;
  readonly #reason: SkipReason;
  readonly #detail: string | undefined;

  private constructor(props: Parameters<typeof VerificationSkipped.of>[0]) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#detail = props.detail;
  }

  static of(props: { target: TargetId; reason: SkipReason; detail?: string }): VerificationSkipped {
    return new VerificationSkipped(props);
  }

  target(): TargetId {
    return this.#target;
  }

  reason(): string {
    return this.#reason.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }

  isFor(target: TargetId): boolean {
    return this.#target.equals(target);
  }

  // 契約2 の正準順: target の id 順、次いで reason の辞書順。
  compareTo(other: VerificationSkipped): number {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0) return c;
    return this.#reason.compareTo(other.#reason);
  }
}
