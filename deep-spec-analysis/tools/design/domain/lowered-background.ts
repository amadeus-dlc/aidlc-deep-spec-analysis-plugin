import type { Expression } from "../../kernel/domain/index.ts";
import type { LoweredId } from "./lowered-id.ts";

// lowered v1 背景制約（#71 波20）。
export class LoweredBackground {
  readonly #id: LoweredId;
  readonly #assert: Expression;

  private constructor(props: { id: LoweredId; assert: Expression }) {
    this.#id = props.id;
    this.#assert = props.assert;
  }

  static reconstitute(props: { id: LoweredId; assert: Expression }): LoweredBackground {
    return new LoweredBackground(props);
  }

  id(): LoweredId {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }
}
