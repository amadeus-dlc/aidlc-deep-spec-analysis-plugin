import type { Expression } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import type { DesignBackgroundIdentifier } from "./design-background-identifier.ts";
import { LoweredBackground } from "./lowered-background.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";

// 設計ユニットの背景仮定 1 件——id と表明。lowering は正準順（id の compareTo）で
// 並べ、表明を BG-n へ載せる（#71 波25）。
type DesignBackgroundAssumptionParam = { id: DesignBackgroundIdentifier; assert: Expression };

export class DesignBackgroundAssumption {
  readonly #id: DesignBackgroundIdentifier;
  readonly #assert: Expression;

  private constructor(props: DesignBackgroundAssumptionParam) {
    this.#id = props.id;
    this.#assert = ExpressionTree.of(props.assert).asExpression();
  }

  static parse(props: DesignBackgroundAssumptionParam): Result<DesignBackgroundAssumption, ParseError> {
    return parseConstruction(() => new DesignBackgroundAssumption(props));
  }

  static of(props: DesignBackgroundAssumptionParam): DesignBackgroundAssumption {
    return new DesignBackgroundAssumption(props);
  }

  id(): DesignBackgroundIdentifier {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }

  compareTo(other: DesignBackgroundAssumption): number {
    return this.#id.compareTo(other.#id);
  }

  // 契約1 への lowering——表明を BG-n へ載せる。
  loweredAs(id: LoweredIdentifier): LoweredBackground {
    return LoweredBackground.of({ id, assert: this.#assert });
  }
}
