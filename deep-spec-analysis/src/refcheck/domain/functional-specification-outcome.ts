import type { StateMachineSketches } from "./state-machine-sketches.ts";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { DeclaredEntities } from "./declared-entities.ts";
import { FD_S1, FD_S2 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";

// functional-spec.md の状態機械スケッチ——文書が無い（absent）か、読めた
// （present：機械群、空でもよい）。FD-S 検査は `match` で解釈へ命じる
// （#71 波26）。
export class FunctionalSpecificationOutcome {
  readonly #machines: StateMachineSketches | null;

  private constructor(machines: StateMachineSketches | null) {
    this.#machines = machines;
  }

  static absent(): FunctionalSpecificationOutcome {
    return new FunctionalSpecificationOutcome(null);
  }

  static present(machines: StateMachineSketches): FunctionalSpecificationOutcome {
    return new FunctionalSpecificationOutcome(machines);
  }

  match<T>(handlers: { absent: () => T; present: (machines: StateMachineSketches) => T }): T {
    return this.#machines === null ? handlers.absent() : handlers.present(this.#machines);
  }


  // FD-S の門（種別規律の裁定 13）: 文書が無い、または entities が使えなければ
  // FD-S1／S2 を skip。読めていれば機械群が FD-S1／S2 を書く。文言は golden 凍結。
  check(report: ReferenceCheckReport, specArtifact: ArtifactPath, entitiesArtifact: ArtifactPath, entities: DeclaredEntities | null): void {
    this.match<void>({
      absent: () => {
        report.skip(FD_S1, "absent-input", "functional-spec.md is not present in this unit's functional-design record");
        report.skip(FD_S2, "absent-input", "functional-spec.md is not present in this unit's functional-design record");
      },
      present: (machines) => {
        if (entities === null) {
          report.skip(FD_S1, "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
          report.skip(FD_S2, "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
          return;
        }
        machines.check(report, specArtifact, entitiesArtifact, entities);
      },
    });
  }
}
