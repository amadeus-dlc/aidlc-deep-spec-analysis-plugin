import type { ComponentShapeErrors } from "./component-shape-errors.ts";
import type { Components } from "./components.ts";
import type { LineNumber } from "./line-number.ts";

// components.md の yaml 真実源ブロックの解析結果——フェンス数が違う、解析
// できない、抽出できた（成分と形の誤り）。DD 検査は `match` で解釈へ命じる
// ——kind を読んで分岐する代わりに（#71 波26）。
export class ComponentCatalogOutcome {
  readonly #kind: "wrong-fence-count" | "unparseable" | "extracted";
  readonly #found: number;
  readonly #line: LineNumber | null;
  readonly #error: string | null;
  readonly #components: Components | null;
  readonly #shapeErrors: ComponentShapeErrors | null;

  private constructor(props: {
    kind: "wrong-fence-count" | "unparseable" | "extracted";
    found: number;
    line: LineNumber | null;
    error: string | null;
    components: Components | null;
    shapeErrors: ComponentShapeErrors | null;
  }) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#components = props.components;
    this.#shapeErrors = props.shapeErrors;
  }

  static wrongFenceCount(found: number): ComponentCatalogOutcome {
    return new ComponentCatalogOutcome({ kind: "wrong-fence-count", found, line: null, error: null, components: null, shapeErrors: null });
  }

  static unparseable(line: LineNumber, error: string): ComponentCatalogOutcome {
    return new ComponentCatalogOutcome({ kind: "unparseable", found: 0, line, error, components: null, shapeErrors: null });
  }

  static extracted(components: Components, shapeErrors: ComponentShapeErrors): ComponentCatalogOutcome {
    return new ComponentCatalogOutcome({ kind: "extracted", found: 0, line: null, error: null, components, shapeErrors });
  }

  match<T>(handlers: {
    wrongFenceCount: (found: number) => T;
    unparseable: (line: LineNumber, error: string) => T;
    extracted: (components: Components, shapeErrors: ComponentShapeErrors) => T;
  }): T {
    if (this.#kind === "wrong-fence-count") return handlers.wrongFenceCount(this.#found);
    if (this.#kind === "unparseable" && this.#line !== null) return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#components === null || this.#shapeErrors === null) throw new Error("defect: an extracted component catalog carries no components");
    return handlers.extracted(this.#components, this.#shapeErrors);
  }
}
