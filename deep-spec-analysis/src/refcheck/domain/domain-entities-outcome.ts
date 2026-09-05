import type { ArtifactPath, UnitName } from "@deep-spec/kernel-domain";
import type { DomainEntitySketches } from "./domain-entity-sketches.ts";
import { XS_1, XS_2, XS_3 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";

// domain-design の components.md から読む実体スケッチ——文書が無い（absent）、
// yaml が使えない（unusable：理由つき）、抽出できた（extracted）。XS 検査は
// `match` で解釈へ命じる（#71 波26）。
export class DomainEntitiesOutcome {
  readonly #kind: "absent" | "unusable" | "extracted";
  readonly #error: string | null;
  readonly #entities: DomainEntitySketches | null;

  private constructor(
    kind: "absent" | "unusable" | "extracted",
    error: string | null,
    entities: DomainEntitySketches | null,
  ) {
    this.#kind = kind;
    this.#error = error;
    this.#entities = entities;
  }

  static absent(): DomainEntitiesOutcome {
    return new DomainEntitiesOutcome("absent", null, null);
  }

  static unusable(error: string): DomainEntitiesOutcome {
    return new DomainEntitiesOutcome("unusable", error, null);
  }

  static extracted(entities: DomainEntitySketches): DomainEntitiesOutcome {
    return new DomainEntitiesOutcome("extracted", null, entities);
  }

  // 抽出できたか——リポジトリは兄弟ユニットをこのときだけ読む。
  isExtracted(): boolean {
    return this.#kind === "extracted";
  }

  match<T>(handlers: {
    absent: () => T;
    unusable: (error: string) => T;
    extracted: (entities: DomainEntitySketches) => T;
  }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "unusable" || this.#entities === null) return handlers.unusable(this.#error ?? "");
    return handlers.extracted(this.#entities);
  }

  // XS の門（種別規律の裁定 13）: components.md が無い／使えなければ XS-1..3 を
  // skip。抽出できれば実体素描が XS-1..3 を書く。文言は golden 凍結。
  check(
    report: ReferenceCheckReport,
    componentsArtifact: ArtifactPath,
    siblingUnits: SiblingUnitIndex,
    unit: UnitName | undefined,
  ): void {
    this.match<void>({
      absent: () => {
        for (const f of [XS_1, XS_2, XS_3]) {
          report.skip(f, "absent-input", "domain-design components.md is not present under this intent record");
        }
      },
      unusable: (error) => {
        for (const f of [XS_1, XS_2, XS_3]) {
          report.skip(f, "unrecognized-format", `components.md yaml block is unusable (${error})`);
        }
      },
      extracted: (domainEntities) => {
        domainEntities.check(report, componentsArtifact, siblingUnits, unit);
      },
    });
  }
}
