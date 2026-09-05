// LoweringIndex — lowering の対応表（lowered id → 由来、lowered scenario id →
// design scenario id、遷移 id → 機械、機械 id → 属性パス）。キーは DP、内側は
// KeyedIndex（裁定 3-1、2026-09-03）。lowered id の書き換え（文言中の `OB-n`、
// SMT ラベル中の `OB_n`）は索引自身の知識。

import { AttributePath, KeyedIndex } from "@deep-spec/kernel-domain";
import type { DesignMachine } from "./design-machine.ts";
import { DesignMachineIdentifier } from "./design-machine-identifier.ts";
import { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";
import { DesignTransitionIdentifier } from "./design-transition-identifier.ts";
import { LoweredIdentifier } from "./lowered-identifier.ts";
import { LoweredOriginReference } from "./lowered-origin-reference.ts";
import { LoweredOrigin } from "./lowered-origin.ts";

function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweringIndexParam = {
  origins: KeyedIndex<LoweredIdentifier, LoweredOrigin>;
  scenarioDesignIds: KeyedIndex<LoweredIdentifier, DesignScenarioIdentifier>;
  machinesByTransition: KeyedIndex<DesignTransitionIdentifier, DesignMachine>;
  attrPathsByMachine: KeyedIndex<DesignMachineIdentifier, AttributePath>;
};

export class LoweringIndex {
  readonly #origins: KeyedIndex<LoweredIdentifier, LoweredOrigin>;
  readonly #scenarioDesignIds: KeyedIndex<LoweredIdentifier, DesignScenarioIdentifier>;
  readonly #machinesByTransition: KeyedIndex<DesignTransitionIdentifier, DesignMachine>;
  readonly #attrPathsByMachine: KeyedIndex<DesignMachineIdentifier, AttributePath>;

  private constructor(props: LoweringIndexParam) {
    this.#origins = props.origins;
    this.#scenarioDesignIds = props.scenarioDesignIds;
    this.#machinesByTransition = props.machinesByTransition;
    this.#attrPathsByMachine = props.attrPathsByMachine;
  }

  static of(props: LoweringIndexParam): LoweringIndex {
    return new LoweringIndex(props);
  }

  originOf(loweredId: string): LoweredOrigin | null {
    return this.#origins.get(LoweredIdentifier.of(loweredId)) ?? null;
  }

  resolveDesignTarget(loweredId: string): { design: string; entry: LoweredOrigin | null } {
    const entry = this.#origins.get(LoweredIdentifier.of(loweredId)) ?? null;
    if (entry) return { design: entry.design().asString(), entry };
    const dsc = this.#scenarioDesignIds.get(LoweredIdentifier.of(loweredId));
    if (dsc) return { design: dsc.asString(), entry: null };
    return { design: loweredId, entry: null };
  }

  rewriteLoweredIds(text: string): string {
    return text.replace(/\bOB-([0-9]+)\b/g, (m, num) => this.#origins.get(LoweredIdentifier.of(`OB-${num}`))?.design().asString() ?? m);
  }

  rewriteLoweredIdTokens(label: string): string {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.#origins.get(LoweredIdentifier.of(`OB-${num}`));
      return entry ? designToken(entry.design().asString()) : m;
    });
  }

  isTransition(designId: string): boolean {
    const parsed = DesignTransitionIdentifier.parse(designId);
    return parsed.ok && this.#machinesByTransition.has(parsed.value);
  }

  machineOfTransition(designId: string): DesignMachine | null {
    const parsed = DesignTransitionIdentifier.parse(designId);
    return parsed.ok ? this.#machinesByTransition.get(parsed.value) ?? null : null;
  }

  attrPathOfMachine(machineId: string): string | null {
    const parsed = DesignMachineIdentifier.parse(machineId);
    return parsed.ok ? this.#attrPathsByMachine.get(parsed.value)?.asString() ?? null : null;
  }

  withPassthrough(loweredId: string, designId: string): LoweringIndex {
    return new LoweringIndex({
      origins: this.#origins.with(LoweredIdentifier.of(loweredId), LoweredOrigin.of({ design: LoweredOriginReference.of(designId), kind: "passthrough" })),
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
