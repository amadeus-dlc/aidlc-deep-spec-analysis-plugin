import { type SkipReason, TargetIdentifier, type UnitName } from "@deep-spec-analysis/kernel-domain";
import { DesignSkipped } from "./design-skipped.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";
import type { LoweringIndex } from "./lowering-index.ts";

// 兄弟バックエンドのskip。自分の対象と文言を設計上の帰属へ写し替える。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SiblingVerdictSkipParam = { target: LoweredIdentifier; reason: SkipReason; detail?: string };

export class SiblingVerdictSkip {
  readonly #target: LoweredIdentifier;
  readonly #reason: SkipReason;
  readonly #detail: string | undefined;

  private constructor(props: SiblingVerdictSkipParam) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#detail = props.detail;
  }

  static of(props: SiblingVerdictSkipParam): SiblingVerdictSkip {
    return new SiblingVerdictSkip(props);
  }

  remap(unit: UnitName, index: LoweringIndex): DesignSkipped | null {
    const mapped = index.resolveDesignTarget(this.#target.asString());
    if (mapped.entry?.isSyntheticProbe()) return null;
    return DesignSkipped.of({
      target: TargetIdentifier.of(mapped.design),
      reason: this.#reason,
      unit,
      ...(this.#detail !== undefined ? { detail: index.rewriteLoweredIds(this.#detail) } : {}),
    });
  }

  target(): LoweredIdentifier {
    return this.#target;
  }

  reason(): string {
    return this.#reason.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }
}
