import { DesignSkipped } from "@deep-spec/design-domain";
import { SkipReason, type TargetIdentifier, UnitName } from "@deep-spec/kernel-domain";

// 要件義務／シナリオ 1 件の refinement 被覆状態。checkable（検査へ進む）、
// waived（unmapped[] による人間の免除——理由つき）、gap（マップの欠落——
// finding になる）、capability（v1 の範囲外——skip になる）。状態が導く skip
// と gap の説明は状態自身の知識（#71 波22）。reason / detail は prose。
export class RefinementStatus {
  readonly #kind: "checkable" | "waived" | "gap" | "capability";
  readonly #text: string;

  private constructor(props: { kind: "checkable" | "waived" | "gap" | "capability"; text: string }) {
    this.#kind = props.kind;
    this.#text = props.text;
  }

  static checkable(): RefinementStatus {
    return new RefinementStatus({ kind: "checkable", text: "" });
  }

  static waived(reason: string): RefinementStatus {
    return new RefinementStatus({ kind: "waived", text: reason });
  }

  static gap(detail: string): RefinementStatus {
    return new RefinementStatus({ kind: "gap", text: detail });
  }

  static capability(detail: string): RefinementStatus {
    return new RefinementStatus({ kind: "capability", text: detail });
  }

  isCheckable(): boolean {
    return this.#kind === "checkable";
  }

  // マップの欠落なら finding の説明、そうでなければ null。
  gapDetail(): string | null {
    return this.#kind === "gap" ? this.#text : null;
  }

  // 免除と範囲外は被覆 skip（凍結の reason 語彙）。checkable / gap は skip しない。
  skipFor(target: TargetIdentifier, unit: string): DesignSkipped | null {
    if (this.#kind === "waived")
      return DesignSkipped.of({ target, reason: SkipReason.waived(), unit: UnitName.of(unit), detail: this.#text });
    if (this.#kind === "capability")
      return DesignSkipped.of({ target, reason: SkipReason.capability(), unit: UnitName.of(unit), detail: this.#text });
    return null;
  }
}
