// LoweringIndex — lowering の対応表（lowered id → 由来、lowered scenario id →
// design scenario id、遷移 id → 機械、機械 id → 属性パス）。キーは DP、内側は
// KeyedIndex（裁定 3-1、2026-09-03）。lowered id の書き換え（文言中の `OB-n`、
// SMT ラベル中の `OB_n`）は索引自身の知識。

import { AttributePath, KeyedIndex } from "@deep-spec/kernel-domain";
import type { DesignMachine } from "./design-machine.ts";
import { DesignMachineId } from "./design-machine-id.ts";
import { DesignScenarioId } from "./design-scenario-id.ts";
import { DesignTransitionId } from "./design-transition-id.ts";
import { LoweredId } from "./lowered-id.ts";
import { LoweredOriginRef } from "./lowered-origin-ref.ts";
import { LoweredOrigin } from "./lowered-origin.ts";

function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

export class LoweringIndex {
  readonly #origins: KeyedIndex<LoweredId, LoweredOrigin>;
  readonly #scenarioDesignIds: KeyedIndex<LoweredId, DesignScenarioId>;
  readonly #machinesByTransition: KeyedIndex<DesignTransitionId, DesignMachine>;
  readonly #attrPathsByMachine: KeyedIndex<DesignMachineId, AttributePath>;

  private constructor(props: {
    origins: KeyedIndex<LoweredId, LoweredOrigin>;
    scenarioDesignIds: KeyedIndex<LoweredId, DesignScenarioId>;
    machinesByTransition: KeyedIndex<DesignTransitionId, DesignMachine>;
    attrPathsByMachine: KeyedIndex<DesignMachineId, AttributePath>;
  }) {
    this.#origins = props.origins;
    this.#scenarioDesignIds = props.scenarioDesignIds;
    this.#machinesByTransition = props.machinesByTransition;
    this.#attrPathsByMachine = props.attrPathsByMachine;
  }

  static of(props: {
    origins: KeyedIndex<LoweredId, LoweredOrigin>;
    scenarioDesignIds: KeyedIndex<LoweredId, DesignScenarioId>;
    machinesByTransition: KeyedIndex<DesignTransitionId, DesignMachine>;
    attrPathsByMachine: KeyedIndex<DesignMachineId, AttributePath>;
  }): LoweringIndex {
    return new LoweringIndex(props);
  }

  originOf(loweredId: string): LoweredOrigin | null {
    return this.#origins.get(LoweredId.reconstitute(loweredId)) ?? null;
  }

  resolveDesignTarget(loweredId: string): { design: string; entry: LoweredOrigin | null } {
    const entry = this.#origins.get(LoweredId.reconstitute(loweredId)) ?? null;
    if (entry) return { design: entry.design().asString(), entry };
    const dsc = this.#scenarioDesignIds.get(LoweredId.reconstitute(loweredId));
    if (dsc) return { design: dsc.asString(), entry: null };
    return { design: loweredId, entry: null };
  }

  rewriteLoweredIds(text: string): string {
    return text.replace(/\bOB-([0-9]+)\b/g, (m, num) => this.#origins.get(LoweredId.reconstitute(`OB-${num}`))?.design().asString() ?? m);
  }

  rewriteLoweredIdTokens(label: string): string {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.#origins.get(LoweredId.reconstitute(`OB-${num}`));
      return entry ? designToken(entry.design().asString()) : m;
    });
  }

  isTransition(designId: string): boolean {
    return this.#machinesByTransition.has(DesignTransitionId.reconstitute(designId));
  }

  machineOfTransition(designId: string): DesignMachine | null {
    return this.#machinesByTransition.get(DesignTransitionId.reconstitute(designId)) ?? null;
  }

  attrPathOfMachine(machineId: string): string | null {
    return this.#attrPathsByMachine.get(DesignMachineId.reconstitute(machineId))?.asString() ?? null;
  }

  withPassthrough(loweredId: string, designId: string): LoweringIndex {
    return new LoweringIndex({
      origins: this.#origins.with(LoweredId.reconstitute(loweredId), LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(designId), kind: "passthrough" })),
      scenarioDesignIds: this.#scenarioDesignIds,
      machinesByTransition: this.#machinesByTransition,
      attrPathsByMachine: this.#attrPathsByMachine,
    });
  }

  // 境界: lowered id → 由来の対応（描画順は採番順）。
  toOriginEntries(): readonly (readonly [string, LoweredOrigin])[] {
    return [...this.#origins].map(([id, origin]) => [id.asString(), origin] as const);
  }
}
