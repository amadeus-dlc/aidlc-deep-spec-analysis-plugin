import type { FindingTargets, TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignFinding } from "./design-finding.ts";
import type { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";
import type { RuleSubsumptionVerdict } from "./rule-subsumption-verdict.ts";

export class RuleSubsumption {
  readonly #probe: RuleSubsumptionProbe;
  readonly #finding: DesignFinding;
  private constructor(verdict: RuleSubsumptionVerdict) {
    const finding = verdict.finding();
    if (finding === null) throw new IllegalArgumentException({ kind: "unproved-subsumption" });
    this.#probe = verdict.probe();
    this.#finding = finding;
  }
  static of(verdict: RuleSubsumptionVerdict): RuleSubsumption {
    return new RuleSubsumption(verdict);
  }
  static parse(verdict: RuleSubsumptionVerdict): Result<RuleSubsumption, ParseError> {
    return parseConstruction(() => new RuleSubsumption(verdict));
  }
  isReverseOf(other: RuleSubsumption): boolean {
    return this.#probe.isReverseOf(other.#probe);
  }
  mentionsAny(dead: TargetIdentifiers): boolean {
    return this.#probe.mentionsAny(dead);
  }
  targets(): FindingTargets {
    return this.#probe.targets();
  }
  finding(): DesignFinding {
    return this.#finding;
  }
  equivalenceFinding(): DesignFinding {
    const [a, b] = this.targets().toStrings();
    return this.#finding.withDetail(
      `${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.`,
    );
  }
}
