import { CD_1, CD_3 } from "./contract-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { UnitDeclarations } from "./unit-declarations.ts";

// unit-of-work-dependency.md の units エッジブロック——文書が無い（absent）、
// 読めるブロックが無い（unrecognized：任意の理由つき）、宣言が読めた
// （declared）。CD 検査は `match` で解釈へ命じる（#71 波26）。
export class DeclaredUnitsOutcome {
  readonly #kind: "absent" | "unrecognized" | "declared";
  readonly #error: string | undefined;
  readonly #units: UnitDeclarations | null;

  private constructor(
    kind: "absent" | "unrecognized" | "declared",
    error: string | undefined,
    units: UnitDeclarations | null,
  ) {
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

  static declared(units: UnitDeclarations): DeclaredUnitsOutcome {
    return new DeclaredUnitsOutcome("declared", undefined, units);
  }

  match<T>(handlers: {
    absent: () => T;
    unrecognized: (error: string | undefined) => T;
    declared: (units: UnitDeclarations) => T;
  }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "unrecognized" || this.#units === null) return handlers.unrecognized(this.#error);
    return handlers.declared(this.#units);
  }

  // CD-1／CD-3 の前提（種別規律の裁定 12）: 宣言済みユニットが使えなければ
  // 両 family を skip して null、使えれば宣言を返す。文言は golden 凍結。
  check(report: ReferenceCheckReport): UnitDeclarations | null {
    return this.match<UnitDeclarations | null>({
      absent: () => {
        report.skip(
          CD_1,
          "absent-input",
          "unit-of-work-dependency.md is not present under this intent record — declared units are unknown",
        );
        report.skip(
          CD_3,
          "absent-input",
          "unit-of-work-dependency.md is not present under this intent record — the unit dependency DAG is unknown",
        );
        return null;
      },
      unrecognized: (error) => {
        report.skip(
          CD_1,
          "unrecognized-format",
          `unit-of-work-dependency.md carries no parseable \`units:\` edge block${error ? ` (${error})` : ""}`,
        );
        report.skip(CD_3, "unrecognized-format", "blocked: the units edge block is unusable");
        return null;
      },
      declared: (declaredUnits) => declaredUnits,
    });
  }
}
