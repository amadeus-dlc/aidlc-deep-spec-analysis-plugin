import { FirstClassCollectionBase, KeyedIndex, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignEventRule } from "./design-event-rule.ts";
import { DesignMachines } from "./design-machines.ts";
import type { DesignUnit } from "./design-unit.ts";
import { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";

export class DesignEventRuleCatalog extends FirstClassCollectionBase<DesignEventRule, DesignEventRuleCatalog> {
  readonly #events: KeyedIndex<TargetIdentifier, DesignEventRule>;

  private constructor(events: Iterable<DesignEventRule>) {
    super();
    const snapshot: DesignEventRule[] = [];
    const references = new Set<string>();
    for (const event of events) {
      if (snapshot.length >= 65_536)
        throw new IllegalArgumentException({ kind: "too-many-design-event-rules", raw: snapshot.length + 1 });
      const reference = event.reference().asString();
      if (references.has(reference))
        throw new IllegalArgumentException({ kind: "duplicate-design-event-rule", raw: reference });
      references.add(reference);
      snapshot.push(event);
    }
    this.#events = KeyedIndex.of(
      snapshot.map((event) => [TargetIdentifier.of(event.reference().asString()), event] as const),
    );
  }

  protected override rebuild(values: readonly DesignEventRule[]): DesignEventRuleCatalog {
    return new DesignEventRuleCatalog(values);
  }
  override map(transform: (element: DesignEventRule) => DesignEventRule): DesignEventRuleCatalog {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }
  override combine(other: DesignEventRuleCatalog): DesignEventRuleCatalog {
    return this.combineTo(other, (values) => this.rebuild(values));
  }
  static of(unit: DesignUnit): DesignEventRuleCatalog {
    return new DesignEventRuleCatalog(DesignEventRuleCatalog.eventsOf(unit));
  }
  static parse(unit: DesignUnit): Result<DesignEventRuleCatalog, ParseError> {
    return parseConstruction(() => new DesignEventRuleCatalog(DesignEventRuleCatalog.eventsOf(unit)));
  }
  private static *eventsOf(unit: DesignUnit): Iterable<DesignEventRule> {
    for (const obligation of unit.obligations().sortedCanonically()) {
      const event = obligation.asEventRule();
      if (event !== null) yield event;
    }
    for (const machine of unit.machines().sortedCanonically())
      for (const transition of machine.transitions().sortedCanonically())
        yield transition.asEventRule(DesignMachines.attrPathOf(machine));
  }
  eventOf(id: TargetIdentifier): DesignEventRule | null {
    const event = this.#events.get(id);
    return event?.hasAssignments() ? event : null;
  }
  override *[Symbol.iterator](): Iterator<DesignEventRule> {
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
}
