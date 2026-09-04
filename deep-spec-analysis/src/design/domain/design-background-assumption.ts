import type { Expression } from "@deep-spec/kernel-domain";
import type { DesignBackgroundId } from "./design-background-id.ts";
import type { LoweredId } from "./lowered-id.ts";
import { LoweredBackground } from "./lowered-background.ts";

// 設計ユニットの背景仮定 1 件——id と表明。lowering は正準順（id の compareTo）で
// 並べ、表明を BG-n へ載せる（#71 波25）。
export class DesignBackgroundAssumption {
  readonly #id: DesignBackgroundId;
  readonly #assert: Expression;

  private constructor(id: DesignBackgroundId, assert: Expression) {
    this.#id = id;
    this.#assert = assert;
  }

  static reconstitute(props: { id: DesignBackgroundId; assert: Expression }): DesignBackgroundAssumption {
    return new DesignBackgroundAssumption(props.id, props.assert);
  }

  id(): DesignBackgroundId {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }

  compareTo(other: DesignBackgroundAssumption): number {
    return this.#id.compareTo(other.#id);
  }

  // 契約1 への lowering——表明を BG-n へ載せる。
  loweredAs(id: LoweredId): LoweredBackground {
    return LoweredBackground.reconstitute({ id, assert: this.#assert });
  }
}
