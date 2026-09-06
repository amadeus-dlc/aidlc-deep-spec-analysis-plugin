import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import { KeyedIndex, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignEventRule } from "./design-event-rule.ts";
import { DesignMachines } from "./design-machines.ts";
import type { DesignUnit } from "./design-unit.ts";
import { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";

export class DesignEventRuleCatalog implements FirstClassCollection, IterableFirstClassCollection<DesignEventRule> {
  readonly #events: KeyedIndex<TargetIdentifier, DesignEventRule>;
  private constructor(unit: DesignUnit) {
    const events: DesignEventRule[] = [];
    for (const obligation of unit.obligations().sortedCanonically()) {
      const event = obligation.asEventRule();
      if (event !== null) events.push(event);
    }
    for (const machine of unit.machines().sortedCanonically())
      for (const transition of machine.transitions().sortedCanonically())
        events.push(transition.asEventRule(DesignMachines.attrPathOf(machine)));
    this.#events = KeyedIndex.of(
      events.map((event) => [TargetIdentifier.of(event.reference().asString()), event] as const),
    );
  }
  static of(unit: DesignUnit): DesignEventRuleCatalog {
    return new DesignEventRuleCatalog(unit);
  }
  static parse(unit: DesignUnit): Result<DesignEventRuleCatalog, ParseError> {
    return parseConstruction(() => new DesignEventRuleCatalog(unit));
  }
  eventOf(id: TargetIdentifier): DesignEventRule | null {
    const event = this.#events.get(id);
    return event?.hasAssignments() ? event : null;
  }
  *[Symbol.iterator](): Iterator<DesignEventRule> {
    yield* this.#events.values();
  }
  subsumptionProbes(): readonly RuleSubsumptionProbe[] {
    const probes: RuleSubsumptionProbe[] = [];
    // Preserve trigger order and event declaration order inside each trigger.
    const events = [...this.#events.values()];
    const byTrigger = new Map<string, DesignEventRule[]>();
    for (const event of events) {
      const key = event.trigger().asString();
      const list = byTrigger.get(key) ?? [];
      list.push(event);
      byTrigger.set(key, list);
    }
    for (const key of [...byTrigger.keys()].sort())
      for (const subsumer of byTrigger.get(key) ?? [])
        for (const subsumed of byTrigger.get(key) ?? []) {
          const parsed = RuleSubsumptionProbe.parse({ subsumer, subsumed });
          if (parsed.ok) probes.push(parsed.value);
        }
    return probes;
  }

  isEmpty(): boolean {
    return this.#events.isEmpty();
  }
}
