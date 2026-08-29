// 設計 IR の 1 ユニット。rawEntities は契約3 のエンティティスキーマ断片の
// 素通し（lowering が契約1 文書へそのまま埋め込む）で、enum 値の照会だけを
// ドメインが行う。allUnitTargets / enumValuesOf は旧自由関数のメソッド化。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type { DesignMachine } from "./design-machine.ts";
import type { DesignObligation } from "./design-obligation.ts";
import type { DesignScenario } from "./design-scenario.ts";
import type { DesignValue } from "./design-value.ts";

export interface DesignBackgroundAssumption {
  id: string;
  assert: Expression;
}

export interface DesignUnitSeed {
  readonly unit: string;
  readonly rawEntities: DesignValue;
  readonly attrPaths: ReadonlySet<string>;
  readonly obligations: readonly DesignObligation[];
  readonly machines: readonly DesignMachine[];
  readonly scenarios: readonly DesignScenario[];
  readonly background: readonly DesignBackgroundAssumption[];
}

function isRecord(v: DesignValue): v is { [k: string]: DesignValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export class DesignUnit {
  readonly #unit: string;
  readonly #rawEntities: DesignValue;
  readonly #attrPaths: ReadonlySet<string>;
  readonly #obligations: readonly DesignObligation[];
  readonly #machines: readonly DesignMachine[];
  readonly #scenarios: readonly DesignScenario[];
  readonly #background: readonly DesignBackgroundAssumption[];

  private constructor(seed: DesignUnitSeed) {
    this.#unit = seed.unit;
    this.#rawEntities = seed.rawEntities;
    this.#attrPaths = seed.attrPaths;
    this.#obligations = seed.obligations;
    this.#machines = seed.machines;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: DesignUnitSeed): DesignUnit {
    return new DesignUnit(seed);
  }

  name(): string {
    return this.#unit;
  }

  // 境界: lowering が契約1 文書の schema.entities へ逐語で埋め込む断片。
  rawEntities(): DesignValue {
    return this.#rawEntities;
  }

  attrPaths(): ReadonlySet<string> {
    return this.#attrPaths;
  }

  obligations(): readonly DesignObligation[] {
    return this.#obligations;
  }

  machines(): readonly DesignMachine[] {
    return this.#machines;
  }

  scenarios(): readonly DesignScenario[] {
    return this.#scenarios;
  }

  background(): readonly DesignBackgroundAssumption[] {
    return this.#background;
  }

  // このユニットでバックエンドが検査し得る全対象（義務・遷移・シナリオ）。
  allTargets(): string[] {
    return sortedUnique(
      [
        ...this.#obligations.map((o) => o.id),
        ...this.#machines.flatMap((m) => m.transitions.map((t) => t.id)),
        ...this.#scenarios.map((s) => s.id),
      ],
      idCompare,
    );
  }

  // 属性パスの enum 宣言値（未宣言・非 enum は空）。旧 enumValuesOf の逐語移植。
  enumValuesOf(attrPath: string): string[] {
    if (!Array.isArray(this.#rawEntities)) return [];
    for (const ent of this.#rawEntities) {
      if (!isRecord(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isRecord(attr) || typeof attr.name !== "string" || !isRecord(attr.type)) continue;
        if (`${ent.name}.${attr.name}` !== attrPath) continue;
        const values = attr.type.values;
        return Array.isArray(values) ? (values.filter((v): v is string => typeof v === "string") as string[]) : [];
      }
    }
    return [];
  }
}
