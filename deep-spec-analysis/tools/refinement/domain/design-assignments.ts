import type { Expression } from "../../kernel/domain/index.ts";

// 1 イベント分の代入表（設計属性パス → prime なし右辺）。
export class DesignAssignments {
  readonly #values: ReadonlyMap<string, Expression>;

  private constructor(values: ReadonlyMap<string, Expression>) {
    this.#values = values;
  }

  static of(values: ReadonlyMap<string, Expression>): DesignAssignments {
    return new DesignAssignments(new Map(values));
  }

  rhsOf(path: string): Expression | undefined {
    return this.#values.get(path);
  }

}
