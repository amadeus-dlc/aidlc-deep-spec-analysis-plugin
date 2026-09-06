import { FindingKind, type UnitName } from "@deep-spec-analysis/kernel-domain";
import { DesignFinding } from "./design-finding.ts";
import type { DesignWitness } from "./design-witness.ts";
import type { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";
import type { SiblingVerdictFinding } from "./sibling-verdict-finding.ts";

export class RuleSubsumptionVerdict {
  readonly #probe: RuleSubsumptionProbe;
  readonly #finding: DesignFinding | null;
  readonly #decided: boolean;
  private constructor(probe: RuleSubsumptionProbe, finding: DesignFinding | null, decided: boolean) {
    this.#probe = probe;
    this.#finding = finding;
    this.#decided = decided;
  }
  static fromFinding(
    probe: RuleSubsumptionProbe,
    source: SiblingVerdictFinding,
    witness: DesignWitness,
    unit: UnitName,
  ): RuleSubsumptionVerdict {
    const finding = source.isKind("conflict")
      ? DesignFinding.of({
          kind: FindingKind.redundancy(),
          functionalRequirementReferences: source.functionalRequirementReferences(),
          targets: probe.targets(),
          witness,
          unit,
          detail: probe.description(),
        })
      : null;
    return new RuleSubsumptionVerdict(probe, finding, true);
  }
  static undecided(probe: RuleSubsumptionProbe): RuleSubsumptionVerdict {
    return new RuleSubsumptionVerdict(probe, null, false);
  }
  isProved(): boolean {
    return this.#finding !== null;
  }
  isDecided(): boolean {
    return this.#decided;
  }
  probe(): RuleSubsumptionProbe {
    return this.#probe;
  }
  finding(): DesignFinding | null {
    return this.#finding;
  }
}
