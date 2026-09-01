// 設計 IR の 1 ユニット。rawEntities は契約3 のエンティティスキーマ断片の
// 素通し（lowering が契約1 文書へそのまま埋め込む）で、enum 値の照会だけを
// ドメインが行う。allUnitTargets / enumValuesOf は旧自由関数のメソッド化。

import { DesignUnitId } from "./design-unit-id.ts";
import { IdOrder } from "../../kernel/domain/index.ts";
import { DesignMachines } from "./design-machines.ts";
import { DesignObligations } from "./design-obligations.ts";
import { DesignScenarios } from "./design-scenarios.ts";
import type { DesignValue } from "./design-value.ts";
import { AttrPaths } from "./attr-paths.ts";
import { DesignBackgroundAssumptions } from "./design-background-assumptions.ts";
import type { DesignUnitSeed } from "./design-unit-seed.ts";







function isRecord(v: DesignValue): v is { [k: string]: DesignValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export class DesignUnit {
  readonly #unit: string;
  readonly #rawEntities: DesignValue;
  readonly #attrPaths: AttrPaths;
  readonly #obligations: DesignObligations;
  readonly #machines: DesignMachines;
  readonly #scenarios: DesignScenarios;
  readonly #background: DesignBackgroundAssumptions;

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

  id(): DesignUnitId {
    return DesignUnitId.of(this.#unit);
  }

  // 境界: 文書・文言に逐語で載るユニット名（恒等の値）。
  name(): string {
    return this.#unit;
  }

  // 境界: lowering が契約1 文書の schema.entities へ逐語で埋め込む断片。
  rawEntities(): DesignValue {
    return this.#rawEntities;
  }

  attrPaths(): AttrPaths {
    return this.#attrPaths;
  }

  obligations(): DesignObligations {
    return this.#obligations;
  }

  machines(): DesignMachines {
    return this.#machines;
  }

  scenarios(): DesignScenarios {
    return this.#scenarios;
  }

  background(): DesignBackgroundAssumptions {
    return this.#background;
  }

  // このユニットでバックエンドが検査し得る全対象（義務・遷移・シナリオ）。
  allTargets(): string[] {
    return IdOrder.sortedUnique(
      [...this.#obligations.ids(), ...this.#machines.transitionIds(), ...this.#scenarios.ids()],
      IdOrder.compare,
    );
  }

  // 属性パスの enum 宣言値——null は「属性が見つからない／enum でない」の区別
  // （空配列と混ぜない——refinement の gap 文言の分岐が異なる）。旧 refinement
  // 自由関数 designEnumValues のメソッド化（OOUI 裁定）。
  declaredEnumValuesOf(attrPath: string): string[] | null {
    if (!Array.isArray(this.#rawEntities)) return null;
    for (const ent of this.#rawEntities) {
      if (!isRecord(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isRecord(attr) || typeof attr.name !== "string" || !isRecord(attr.type)) continue;
        if (`${ent.name}.${attr.name}` !== attrPath) continue;
        if (attr.type.kind !== "enum") return null;
        const values = attr.type.values;
        return Array.isArray(values) ? (values.filter((v): v is string => typeof v === "string") as string[]) : null;
      }
    }
    return null;
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

