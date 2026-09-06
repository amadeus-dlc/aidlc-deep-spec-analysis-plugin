import { type SkipReason, TargetIdentifier, type UnitName } from "@deep-spec-analysis/kernel-domain";
import { ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
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

  remap(unit: UnitName, index: LoweringIndex): Result<DesignSkipped | null, ParseError> {
    const resolved = index.resolveDesignTarget(this.#target);
    if (!resolved.ok) return resolved;
    const mapped = resolved.value;
    if (mapped.entry?.isSyntheticProbe()) return ok(null);
    return ok(
      DesignSkipped.of({
        target: TargetIdentifier.of(mapped.design.asString()),
        reason: this.#reason,
        unit,
        ...(this.#detail !== undefined ? { detail: index.rewriteLoweredIds(this.#detail) } : {}),
      }),
    );
  }
}
