import type { BlockIndex } from "./block-index.ts";
import type { LineNumber } from "./line-number.ts";

// contract-summary.md の spec yaml ブロック 1 件の査定——健全か、解析不能か、
// マッピングでないか、openapi に paths が無いか。CD-2 は `matchIssue` で
// 解釈へ命じ、対象 id と所在ラベル（凍結文言）はブロック自身が作る
// （#71 波26）。
export class SpecBlockAssessment {
  readonly #index: BlockIndex;
  readonly #line: LineNumber;
  readonly #issue: "sound" | "unparseable" | "not-a-mapping" | "openapi-without-paths";
  readonly #error: string | null;

  private constructor(index: BlockIndex, line: LineNumber, issue: "sound" | "unparseable" | "not-a-mapping" | "openapi-without-paths", error: string | null) {
    this.#index = index;
    this.#line = line;
    this.#issue = issue;
    this.#error = error;
  }

  static sound(index: BlockIndex, line: LineNumber): SpecBlockAssessment {
    return new SpecBlockAssessment(index, line, "sound", null);
  }

  static unparseable(index: BlockIndex, line: LineNumber, error: string): SpecBlockAssessment {
    return new SpecBlockAssessment(index, line, "unparseable", error);
  }

  static notAMapping(index: BlockIndex, line: LineNumber): SpecBlockAssessment {
    return new SpecBlockAssessment(index, line, "not-a-mapping", null);
  }

  static openapiWithoutPaths(index: BlockIndex, line: LineNumber): SpecBlockAssessment {
    return new SpecBlockAssessment(index, line, "openapi-without-paths", null);
  }

  blockId(): string {
    return `contract:block-${this.#index.asNumber()}`;
  }

  locationLabel(): string {
    return `yaml fence #${this.#index.asNumber()} (line ${this.#line.asNumber()})`;
  }

  matchIssue<T>(handlers: { sound: () => T; unparseable: (error: string) => T; notAMapping: () => T; openapiWithoutPaths: () => T }): T {
    if (this.#issue === "sound") return handlers.sound();
    if (this.#issue === "unparseable") return handlers.unparseable(this.#error ?? "");
    if (this.#issue === "not-a-mapping") return handlers.notAMapping();
    return handlers.openapiWithoutPaths();
  }
}
