import { type ArtifactPath, FindingKind } from "@deep-spec/kernel-domain";
import { DD_0, DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7 } from "./component-check-families.ts";
import type { ComponentShapeErrors } from "./component-shape-errors.ts";
import type { Components } from "./components.ts";
import { FenceCount } from "./fence-count.ts";
import type { LineNumber } from "./line-number.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// components.md の yaml 真実源ブロックの解析結果——フェンス数が違う、解析
// できない、抽出できた（成分と形の誤り）。DD 検査は `match` で解釈へ命じる
// ——kind を読んで分岐する代わりに（#71 波26）。
export class ComponentCatalogOutcome {
  readonly #kind: "wrong-fence-count" | "unparseable" | "extracted";
  readonly #found: FenceCount;
  readonly #line: LineNumber | null;
  readonly #error: string | null;
  readonly #components: Components | null;
  readonly #shapeErrors: ComponentShapeErrors | null;

  private constructor(props: {
    kind: "wrong-fence-count" | "unparseable" | "extracted";
    found: FenceCount;
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

  static wrongFenceCount(found: FenceCount): ComponentCatalogOutcome {
    return new ComponentCatalogOutcome({
      kind: "wrong-fence-count",
      found,
      line: null,
      error: null,
      components: null,
      shapeErrors: null,
    });
  }

  static unparseable(line: LineNumber, error: string): ComponentCatalogOutcome {
    return new ComponentCatalogOutcome({
      kind: "unparseable",
      found: FenceCount.of(0),
      line,
      error,
      components: null,
      shapeErrors: null,
    });
  }

  static extracted(components: Components, shapeErrors: ComponentShapeErrors): ComponentCatalogOutcome {
    return new ComponentCatalogOutcome({
      kind: "extracted",
      found: FenceCount.of(0),
      line: null,
      error: null,
      components,
      shapeErrors,
    });
  }

  match<T>(handlers: {
    wrongFenceCount: (found: number) => T;
    unparseable: (line: LineNumber, error: string) => T;
    extracted: (components: Components, shapeErrors: ComponentShapeErrors) => T;
  }): T {
    if (this.#kind === "wrong-fence-count") return handlers.wrongFenceCount(this.#found.asNumber());
    if (this.#kind === "unparseable" && this.#line !== null) return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#components === null || this.#shapeErrors === null)
      throw new Error("defect: an extracted component catalog carries no components");
    return handlers.extracted(this.#components, this.#shapeErrors);
  }

  // DD-0 の不変条件（種別規律の裁定 11）: fence の形を判定して finding を書き、
  // 使えなければ DD-1..DD-7 を blocked スキップにする。使えるときは Components
  // が DD-1..DD-7 を書く。文言と順序は golden 凍結。
  check(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const art = artifact.asString();
    const usable = this.match<Components | null>({
      wrongFenceCount: (found) => {
        report.finding(
          DD_0,
          FindingKind.structureInvalid(),
          [DD_0.asCheckTarget()],
          [WitnessReference.at(art, "yaml fence")],
          `components.md must carry exactly one fenced yaml source-of-truth block (found ${found})`,
        );
        return null;
      },
      unparseable: (line, error) => {
        report.finding(
          DD_0,
          FindingKind.structureInvalid(),
          [DD_0.asCheckTarget()],
          [WitnessReference.at(art, `yaml fence (line ${line.asNumber()})`)],
          `yaml block does not parse in the supported subset: ${error}`,
        );
        return null;
      },
      extracted: (components, shapeErrors) => {
        for (const e of shapeErrors) {
          report.finding(
            DD_0,
            FindingKind.structureInvalid(),
            [DD_0.asCheckTarget()],
            [WitnessReference.at(art, e.element().asString())],
            e.detail(),
          );
        }
        return shapeErrors.count() > 0 && components.count() === 0 ? null : components;
      },
    });
    if (usable === null) {
      // DD-0 が落ちたとき blocked スキップになる後続ファミリー。
      for (const family of [DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7]) {
        report.skip(family, "unrecognized-format", "blocked by DD-0: the yaml source-of-truth block is unusable");
      }
      return;
    }
    usable.check(report, artifact);
  }
}
