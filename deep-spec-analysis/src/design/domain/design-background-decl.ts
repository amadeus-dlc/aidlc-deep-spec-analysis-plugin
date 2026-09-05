import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
// 設計 IR の背景仮定宣言。抱える式の列挙と prime 禁止（背景仮定は常に
// 無prime）は宣言自身が所有する——波3の義務／シナリオと同じ裁定（#71 波4）。

import { DesignBackgroundId } from "./design-background-id.ts";

export class DesignBackgroundDecl {
  readonly #id: DesignBackgroundId;
  readonly #assert: Expression | undefined;

  private constructor(props: Parameters<typeof DesignBackgroundDecl.of>[0]) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
  }

  static of(props: { id: DesignBackgroundId; assert?: Expression }): DesignBackgroundDecl {
    return new DesignBackgroundDecl(props);
  }

  id(): DesignBackgroundId {
    return this.#id;
  }

  // 背景仮定が抱える唯一の式（不在は沈黙——黙殺条件はパーサ側で確定済み）。
  assertion(): Expression | undefined {
    return this.#assert;
  }

  // 式の役割は宣言が命じる: 背景仮定に prime は許されない（primesAllowed は
  // 常に false で届く）。呼び出し側が false を知る必要はない。
  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
  }
}
