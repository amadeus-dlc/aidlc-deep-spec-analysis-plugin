import type { UnitDecls } from "./unit-decls.ts";

// unit-of-work-dependency.md の units エッジブロック——文書が無い（absent）、
// 読めるブロックが無い（unrecognized：任意の理由つき）、宣言が読めた
// （declared）。CD 検査は `match` で解釈へ命じる（#71 波26）。
export class DeclaredUnitsOutcome {
  readonly #kind: "absent" | "unrecognized" | "declared";
  readonly #error: string | undefined;
  readonly #units: UnitDecls | null;

  private constructor(kind: "absent" | "unrecognized" | "declared", error: string | undefined, units: UnitDecls | null) {
    this.#kind = kind;
    this.#error = error;
    this.#units = units;
  }

  static absent(): DeclaredUnitsOutcome {
    return new DeclaredUnitsOutcome("absent", undefined, null);
  }

  static unrecognized(error?: string): DeclaredUnitsOutcome {
    return new DeclaredUnitsOutcome("unrecognized", error, null);
  }

  static declared(units: UnitDecls): DeclaredUnitsOutcome {
    return new DeclaredUnitsOutcome("declared", undefined, units);
  }

  match<T>(handlers: { absent: () => T; unrecognized: (error: string | undefined) => T; declared: (units: UnitDecls) => T }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "unrecognized" || this.#units === null) return handlers.unrecognized(this.#error);
    return handlers.declared(this.#units);
  }
}
