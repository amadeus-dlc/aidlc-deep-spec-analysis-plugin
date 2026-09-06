import { FindingKind, type UnitName } from "@deep-spec-analysis/kernel-domain";
import { DesignFinding } from "./design-finding.ts";
import type { DesignWitness } from "./design-witness.ts";
import type { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";
import type { SiblingVerdictFinding } from "./sibling-verdict-finding.ts";

type RuleSubsumptionVerdictParam =
  | { kind: "observed"; probe: RuleSubsumptionProbe; finding: DesignFinding | null }
  | { kind: "unobserved"; probe: RuleSubsumptionProbe };

export class RuleSubsumptionVerdict {
  readonly #state: RuleSubsumptionVerdictParam;
  private constructor(state: RuleSubsumptionVerdictParam) {
    this.#state = { ...state };
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
    return new RuleSubsumptionVerdict({ kind: "observed", probe, finding });
  }
  static undecided(probe: RuleSubsumptionProbe): RuleSubsumptionVerdict {
    return new RuleSubsumptionVerdict({ kind: "unobserved", probe });
  }
  isProved(): boolean {
    return this.#state.kind === "observed" && this.#state.finding !== null;
  }
  hasObservation(): boolean {
    return this.#state.kind === "observed";
  }
  probe(): RuleSubsumptionProbe {
    return this.#state.probe;
  }
  finding(): DesignFinding | null {
    return this.#state.kind === "observed" ? this.#state.finding : null;
  }
}
