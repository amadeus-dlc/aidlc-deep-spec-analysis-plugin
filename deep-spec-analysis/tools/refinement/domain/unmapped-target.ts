import type { UnmappedTargetRef } from "./unmapped-target-ref.ts";

// unmapped[] の 1 宣言——写像しないと宣言した要件側の対象とその理由。
// 宣言集合は対象の一致を問い、理由を受け取る（#71 波24）。
export class UnmappedTarget {
  readonly #target: UnmappedTargetRef;
  readonly #reason: string;

  private constructor(target: UnmappedTargetRef, reason: string) {
    this.#target = target;
    this.#reason = reason;
  }

  static reconstitute(props: { target: UnmappedTargetRef; reason: string }): UnmappedTarget {
    return new UnmappedTarget(props.target, props.reason);
  }

  isFor(token: string): boolean {
    return this.#target.asString() === token;
  }

  reason(): string {
    return this.#reason;
  }
}
