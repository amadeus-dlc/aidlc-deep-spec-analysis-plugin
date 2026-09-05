import type { SkipReason, TargetIdentifier } from "@deep-spec/kernel-domain";

// v1 検証 skip（契約2）——対象・理由・任意の説明。正準順（target → reason）と
// 「その対象の skip か」の判定は記録自身の知識（#71 波17）。reason は分類
// 文字列、detail は prose（裁定の恒久除外）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type VerificationSkippedParam = { target: TargetIdentifier; reason: SkipReason; detail?: string };

export class VerificationSkipped {
  readonly #target: TargetIdentifier;
  readonly #reason: SkipReason;
  readonly #detail: string | undefined;

  private constructor(props: VerificationSkippedParam) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#detail = props.detail;
  }

  static of(props: VerificationSkippedParam): VerificationSkipped {
    return new VerificationSkipped(props);
  }

  target(): TargetIdentifier {
    return this.#target;
  }

  reason(): string {
    return this.#reason.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }

  isFor(target: TargetIdentifier): boolean {
    return this.#target.equals(target);
  }

  // 契約2 の正準順: target の id 順、次いで reason の辞書順。
  compareTo(other: VerificationSkipped): number {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0) return c;
    return this.#reason.compareTo(other.#reason);
  }
}
