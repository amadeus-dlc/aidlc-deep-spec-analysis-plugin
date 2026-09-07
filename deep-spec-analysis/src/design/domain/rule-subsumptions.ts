import { FirstClassCollectionBase, type TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import type { RuleSubsumption } from "./rule-subsumption.ts";

export class RuleSubsumptions extends FirstClassCollectionBase<RuleSubsumption, RuleSubsumptions> {
  readonly #values: readonly RuleSubsumption[];
  private constructor(values: readonly RuleSubsumption[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-subsumptions");
  }

  protected override rebuild(values: readonly RuleSubsumption[]): RuleSubsumptions {
    return new RuleSubsumptions(values);
  }

  override *[Symbol.iterator](): Iterator<RuleSubsumption> {
    yield* this.#values;
  }
  static of(values: readonly RuleSubsumption[]): RuleSubsumptions {
    return new RuleSubsumptions(values);
  }
  static parse(values: readonly RuleSubsumption[]): Result<RuleSubsumptions, ParseError> {
    return parseConstruction(() => new RuleSubsumptions(values));
  }
  findingsExcept(dead: TargetIdentifiers): DesignFindings {
    const groups = new Map<string, RuleSubsumption[]>();
    for (const relation of this.#values) {
      if (relation.mentionsAny(dead)) continue;
      const key = relation.targets().joined(",");
      const group = groups.get(key) ?? [];
      group.push(relation);
      groups.set(key, group);
    }
    const findings: DesignFinding[] = [];
    for (const key of [...groups.keys()].sort()) {
      const group = groups.get(key) ?? [];
      const first = group[0];
      if (first !== undefined)
        findings.push(group.some((other) => first.isReverseOf(other)) ? first.equivalenceFinding() : first.finding());
    }
    return DesignFindings.of(findings);
  }
}
