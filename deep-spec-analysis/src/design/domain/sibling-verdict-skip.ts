import { SkipReason } from "@deep-spec/kernel-domain";
import { type LoweredId } from "./lowered-id.ts";

// 兄弟バックエンドの v1 文書が運ぶ skip（lowered 語彙）。remap が設計語彙へ
// 写す材料——対象は lowered id、reason は分類文字列、detail は prose。
// 記録自身は自分の面を差し出すだけ（#71 波22）。
export class SiblingVerdictSkip {
  readonly #target: LoweredId;
  readonly #reason: SkipReason;
  readonly #detail: string | undefined;

  private constructor(props: Parameters<typeof SiblingVerdictSkip.of>[0]) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#detail = props.detail;
  }

  static of(props: { target: LoweredId; reason: SkipReason; detail?: string }): SiblingVerdictSkip {
    return new SiblingVerdictSkip(props);
  }

  target(): LoweredId {
    return this.#target;
  }

  reason(): string {
    return this.#reason.asString();
  }

  detail(): string | undefined {
    return this.#detail;
  }
}
