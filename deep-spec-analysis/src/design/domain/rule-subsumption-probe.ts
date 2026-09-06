import {
  FindingTargets,
  FunctionalRequirementReferences,
  ObligationNature,
  TargetIdentifier,
  type TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";

import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignEventRule } from "./design-event-rule.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";
import { LoweredObligation } from "./lowered-obligation.ts";
import { LoweredOrigin } from "./lowered-origin.ts";
import { LoweredOriginReference } from "./lowered-origin-reference.ts";

type RuleSubsumptionProbeParam = { subsumer: DesignEventRule; subsumed: DesignEventRule };
export class RuleSubsumptionProbe {
  readonly #subsumer: DesignEventRule;
  readonly #subsumed: DesignEventRule;
  private constructor(props: RuleSubsumptionProbeParam) {
    if (props.subsumer.sameRuleAs(props.subsumed)) throw new IllegalArgumentException({ kind: "self-subsumption" });
    if (!props.subsumer.sameTriggerAs(props.subsumed))
      throw new IllegalArgumentException({ kind: "different-subsumption-triggers" });
    if (!props.subsumer.sameEffectAs(props.subsumed))
      throw new IllegalArgumentException({ kind: "different-subsumption-effects" });
    this.#subsumer = props.subsumer;
    this.#subsumed = props.subsumed;
  }
  static of(props: RuleSubsumptionProbeParam): RuleSubsumptionProbe {
    return new RuleSubsumptionProbe(props);
  }
  static parse(props: RuleSubsumptionProbeParam): Result<RuleSubsumptionProbe, ParseError> {
    return parseConstruction(() => new RuleSubsumptionProbe(props));
  }
  references(): readonly [LoweredOriginReference, LoweredOriginReference] {
    return [this.#subsumer.reference(), this.#subsumed.reference()];
  }
  targets(): FindingTargets {
    const [subsumer, subsumed] = this.references();
    return FindingTargets.of(TargetIdentifier.of(subsumer.asString()), [
      TargetIdentifier.of(subsumed.asString()),
    ]).sortedUniqueCanonically();
  }
  isReverseOf(other: RuleSubsumptionProbe): boolean {
    return this.#subsumer.sameRuleAs(other.#subsumed) && this.#subsumed.sameRuleAs(other.#subsumer);
  }
  mentionsAny(targets: TargetIdentifiers): boolean {
    return this.references().some((reference) =>
      [...targets].some((target) => target.asString() === reference.asString()),
    );
  }
  description(): string {
    const [a, b] = this.references();
    return `${b.asString()} is subsumed by ${a.asString()}: same trigger, a provably narrower guard, and an identical effect — it can never apply where ${a.asString()} does not.`;
  }
  // The combined spelling exists only at the published label boundary.
  labelReference(): LoweredOriginReference {
    return LoweredOriginReference.of(
      this.references()
        .map((reference) => reference.asString())
        .join("|"),
    );
  }
  loweredAs(id: LoweredIdentifier): Result<LoweredObligation, ParseError> {
    return LoweredObligation.parse({
      id,
      origin: LoweredOrigin.of({ kind: "vac-shadow", probe: this }),
      nature: ObligationNature.of("invariant"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      assert: {
        op: "implies",
        args: [
          { op: "and", args: [this.#subsumed.guard(), { op: "not", args: [this.#subsumer.guard()] }] },
          { op: "bool", value: true },
        ],
      },
    });
  }
}
