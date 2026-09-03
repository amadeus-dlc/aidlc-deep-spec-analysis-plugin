import type { ElementPath } from "./element-path.ts";

// entities.md の yaml ブロックの形の誤り 1 件——要素パスと文言。FD-E1 は
// 要素を witness に、文言を finding に載せる（#71 波26）。
export class ShapeError {
  readonly #element: ElementPath;
  readonly #detail: string;

  private constructor(element: ElementPath, detail: string) {
    this.#element = element;
    this.#detail = detail;
  }

  static reconstitute(props: { element: ElementPath; detail: string }): ShapeError {
    return new ShapeError(props.element, props.detail);
  }

  element(): ElementPath {
    return this.#element;
  }

  detail(): string {
    return this.#detail;
  }
}
