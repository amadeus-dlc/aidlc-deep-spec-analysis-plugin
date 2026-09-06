import { KeyedIndex, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignEvent } from "./design-event.ts";
import { DesignMachines } from "./design-machines.ts";
import type { DesignUnit } from "./design-unit.ts";
import { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";

export class DesignEventCatalog {
  readonly #events: KeyedIndex<TargetIdentifier, DesignEvent>;
  private constructor(unit: DesignUnit) {
    const events: DesignEvent[] = [];
    for (const obligation of unit.obligations().sortedCanonically()) {
      const event = obligation.asEvent();
      if (event !== null) events.push(event);
    }
    for (const machine of unit.machines().sortedCanonically())
      for (const transition of machine.transitions().sortedCanonically())
        events.push(transition.asEvent(DesignMachines.attrPathOf(machine)));
    this.#events = KeyedIndex.of(
      events.map((event) => [TargetIdentifier.of(event.reference().asString()), event] as const),
    );
  }
  static of(unit: DesignUnit): DesignEventCatalog {
    return new DesignEventCatalog(unit);
  }
  static parse(unit: DesignUnit): Result<DesignEventCatalog, ParseError> {
    return parseConstruction(() => new DesignEventCatalog(unit));
  }
  eventOf(id: TargetIdentifier): DesignEvent | null {
    const event = this.#events.get(id);
    return event?.hasAssignments() ? event : null;
  }
  *[Symbol.iterator](): Iterator<DesignEvent> {
    yield* this.#events.values();
  }
  subsumptionProbes(): readonly RuleSubsumptionProbe[] {
    const probes: RuleSubsumptionProbe[] = [];
    // Preserve trigger order and event declaration order inside each trigger.
    const events = [...this.#events.values()];
    const byTrigger = new Map<string, DesignEvent[]>();
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
