import { AttributePath, KeyedIndex, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import {
  err,
  IllegalArgumentException,
  ok,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignMachines } from "./design-machines.ts";
import { IssuedLoweredIdentifiers } from "./issued-lowered-identifiers.ts";
import type { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import type { LoweredObligations } from "./lowered-obligations.ts";
import { LoweredOriginReference } from "./lowered-origin-reference.ts";
import type { LoweredScenarios } from "./lowered-scenarios.ts";
// LoweringIndex — lowering の対応表（lowered id → 由来、lowered scenario id →
// design scenario id、遷移 id → 機械、機械 id → 属性パス）。キーは DP、内側は
// KeyedIndex（裁定 3-1、2026-09-03）。lowered id の書き換え（文言中の `OB-n`、
// SMT ラベル中の `OB_n`）は索引自身の知識。

import type { DesignMachine } from "./design-machine.ts";
import { DesignMachineIdentifier } from "./design-machine-identifier.ts";
import type { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";
import { DesignTransitionIdentifier } from "./design-transition-identifier.ts";
import { LoweredIdentifier } from "./lowered-identifier.ts";
import type { LoweredOrigin } from "./lowered-origin.ts";

function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

export class LoweringIndex {
  readonly #origins: KeyedIndex<LoweredIdentifier, LoweredOrigin>;
  readonly #scenarioDesignIds: KeyedIndex<LoweredIdentifier, DesignScenarioIdentifier>;
  readonly #machinesByTransition: KeyedIndex<DesignTransitionIdentifier, DesignMachine>;
  readonly #attrPathsByMachine: KeyedIndex<DesignMachineIdentifier, AttributePath>;

  readonly #issued: IssuedLoweredIdentifiers;

  private constructor(
    obligations: LoweredObligations,
    scenarios: LoweredScenarios,
    sourceMachines: DesignMachines,
    background: LoweredBackgrounds,
  ) {
    const ids: LoweredIdentifier[] = [];
    for (const [namespace, entries] of [
      ["OB", obligations],
      ["SC", scenarios],
      ["BG", background],
    ] as const)
      for (const entry of entries) {
        const id = entry.id();
        if (!id.belongsTo(namespace))
          throw new IllegalArgumentException({ kind: "lowered-identifier-namespace-mismatch", raw: id.asString() });
        ids.push(id);
      }
    this.#issued = IssuedLoweredIdentifiers.of(ids);
    const machines: (readonly [DesignTransitionIdentifier, DesignMachine])[] = [];
    const attributes: (readonly [DesignMachineIdentifier, AttributePath])[] = [...sourceMachines].map(
      (machine) => [machine.id(), AttributePath.of(DesignMachines.attrPathOf(machine))] as const,
    );
    for (const obligation of obligations) {
      const origin = obligation.origin();
      const machine = origin.machine();
      const attribute = origin.attribute();
      if (machine !== null && attribute !== null) {
        machines.push([DesignTransitionIdentifier.of(origin.design().asString()), machine]);
        attributes.push([machine.id(), attribute]);
      }
    }
    for (const obligation of obligations)
      if (!obligation.origin().isSyntheticProbe()) TargetIdentifier.of(obligation.origin().design().asString());
    this.#origins = KeyedIndex.of(
      [...obligations].map((obligation) => [obligation.id(), obligation.origin()] as const),
    );
    this.#scenarioDesignIds = KeyedIndex.of(
      [...scenarios].map((scenario) => [scenario.id(), scenario.origin()] as const),
    );
    this.#machinesByTransition = KeyedIndex.of(machines);
    this.#attrPathsByMachine = KeyedIndex.of(attributes);
  }

  static of(
    obligations: LoweredObligations,
    scenarios: LoweredScenarios,
    machines: DesignMachines,
    background: LoweredBackgrounds,
  ): LoweringIndex {
    return new LoweringIndex(obligations, scenarios, machines, background);
  }
  static parse(
    obligations: LoweredObligations,
    scenarios: LoweredScenarios,
    machines: DesignMachines,
    background: LoweredBackgrounds,
  ): Result<LoweringIndex, ParseError> {
    return parseConstruction(() => new LoweringIndex(obligations, scenarios, machines, background));
  }
  availableObligationIdentifiers(): IterableIterator<LoweredIdentifier> {
    return this.#issued.availableObligations();
  }

  originOf(loweredId: string): LoweredOrigin | null {
    const id = LoweredIdentifier.parse(loweredId);
    return id.ok ? (this.#origins.get(id.value) ?? null) : null;
  }

  resolveDesignTarget(
    id: LoweredIdentifier,
  ): Result<{ readonly design: LoweredOriginReference; readonly entry: LoweredOrigin | null }, ParseError> {
    const entry = this.#origins.get(id);
    if (entry !== undefined) return ok({ design: entry.design(), entry });
    const scenario = this.#scenarioDesignIds.get(id);
    if (scenario !== undefined) return ok({ design: LoweredOriginReference.of(scenario.asString()), entry: null });
    return err({ kind: "unknown-lowered-target", raw: id.asString() });
  }

  rewriteLoweredIds(text: string): string {
    return text.replace(/\bOB-([0-9]+)\b/g, (m) => this.originOf(m)?.design().asString() ?? m);
  }

  rewriteLoweredIdTokens(label: string): string {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.originOf(`OB-${num}`);
      return entry ? designToken(entry.design().asString()) : m;
    });
  }

  isTransition(designId: string): boolean {
    const parsed = DesignTransitionIdentifier.parse(designId);
    return parsed.ok && this.#machinesByTransition.has(parsed.value);
  }

  machineOfTransition(designId: string): DesignMachine | null {
    const parsed = DesignTransitionIdentifier.parse(designId);
    return parsed.ok ? (this.#machinesByTransition.get(parsed.value) ?? null) : null;
  }

  attrPathOfMachine(machineId: string): string | null {
    const parsed = DesignMachineIdentifier.parse(machineId);
    return parsed.ok ? (this.#attrPathsByMachine.get(parsed.value)?.asString() ?? null) : null;
  }

  // 境界: lowered id → 由来の対応（描画順は採番順）。
  toOriginEntries(): readonly (readonly [string, LoweredOrigin])[] {
    return [...this.#origins].map(([id, origin]) => [id.asString(), origin] as const);
  }
}
