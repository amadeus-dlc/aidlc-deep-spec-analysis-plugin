import type { SkipReason } from "@deep-spec/kernel-domain";
import type { LoweredIdentifier } from "./lowered-identifier.ts";

// 兄弟バックエンドの v1 文書が運ぶ skip（lowered 語彙）。remap が設計語彙へ
// 写す材料——対象は lowered id、reason は分類文字列、detail は prose。
// 記録自身は自分の面を差し出すだけ（#71 波22）。
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
