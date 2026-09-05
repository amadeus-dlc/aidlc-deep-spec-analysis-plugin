import { type TargetIdentifier, SkipReason, UnitName } from "@deep-spec/kernel-domain";

// 設計検証の skip。対象・理由・ユニットはそれぞれ型付きの値で受け取る。
// 正準順（unit → target → reason）は記録自身の知識。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignSkippedParam = { target: TargetIdentifier; reason: SkipReason; unit: UnitName; detail?: string };

export class DesignSkipped {
  readonly #target: TargetIdentifier;
  readonly #reason: SkipReason;
  readonly #unit: UnitName;
  readonly #detail: string | undefined;

  private constructor(props: DesignSkippedParam) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }

  static of(props: DesignSkippedParam): DesignSkipped {
    return new DesignSkipped(props);
  }

  target(): TargetIdentifier {
    return this.#target;
  }

  reason(): string {
    return this.#reason.asString();
  }

  unit(): string {
    return this.#unit.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }

  isFor(target: TargetIdentifier): boolean {
    return this.#target.equals(target);
  }

  // 正準順: unit の辞書順、次いで target の id 順、次いで reason の辞書順。
  compareTo(other: DesignSkipped): number {
    if (!this.#unit.equals(other.#unit)) return this.#unit.asString() < other.#unit.asString() ? -1 : 1;
    const c = this.#target.compareTo(other.#target);
    if (c !== 0) return c;
    return this.#reason.compareTo(other.#reason);
  }
}
