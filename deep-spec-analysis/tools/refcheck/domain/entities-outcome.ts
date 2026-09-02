import type { DeclaredEntities } from "./declared-entities.ts";
import type { LineNumber } from "./line-number.ts";

// entities.md の yaml 真実源ブロックの解析結果——文書が無い、フェンス数が
// 違う、解析できない、抽出できた。FD-E 検査は `match` で解釈へ命じる
// （#71 波26）。
export class EntitiesOutcome {
  readonly #kind: "absent" | "wrong-fence-count" | "unparseable" | "extracted";
  readonly #found: number;
  readonly #line: LineNumber | null;
  readonly #error: string | null;
  readonly #model: DeclaredEntities | null;

  private constructor(props: { kind: "absent" | "wrong-fence-count" | "unparseable" | "extracted"; found: number; line: LineNumber | null; error: string | null; model: DeclaredEntities | null }) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#model = props.model;
  }

  static absent(): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "absent", found: 0, line: null, error: null, model: null });
  }

  static wrongFenceCount(found: number): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, model: null });
  }

  static unparseable(line: LineNumber, error: string): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "unparseable", found: 0, line, error, model: null });
  }

  static extracted(model: DeclaredEntities): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "extracted", found: 0, line: null, error: null, model });
  }

  match<T>(handlers: {
    absent: () => T;
    wrongFenceCount: (found: number) => T;
    unparseable: (line: LineNumber, error: string) => T;
    extracted: (model: DeclaredEntities) => T;
  }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "wrong-fence-count") return handlers.wrongFenceCount(this.#found);
    if (this.#kind === "unparseable" && this.#line !== null) return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#model === null) throw new Error("defect: an extracted entities document carries no model");
    return handlers.extracted(this.#model);
  }
}
