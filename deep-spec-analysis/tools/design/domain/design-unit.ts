// 設計 IR の 1 ユニット。rawEntities は契約3 のエンティティスキーマ断片の
// 素通し（lowering が契約1 文書へそのまま埋め込む）で、enum 値の照会だけを
// ドメインが行う。allUnitTargets / enumValuesOf は旧自由関数のメソッド化。

import { DesignUnitId } from "./design-unit-id.ts";
import { TargetIds } from "../../kernel/domain/index.ts";
import { DesignMachines } from "./design-machines.ts";
import { DesignObligations } from "./design-obligations.ts";
import { DesignScenarios } from "./design-scenarios.ts";
import type { DesignAttributeDecl } from "./design-attribute-decl.ts";
import type { DesignEntityDecls } from "./design-entity-decls.ts";
import { AttrPaths } from "./attr-paths.ts";
import { DesignBackgroundAssumptions } from "./design-background-assumptions.ts";







export class DesignUnit {
  readonly #unit: string;
  // 契約3 の実体宣言（型付き）。属性座標と enum 宣言値はここから答える。
  readonly #entities: DesignEntityDecls;
  readonly #attrPaths: AttrPaths;
  readonly #obligations: DesignObligations;
  readonly #machines: DesignMachines;
  readonly #scenarios: DesignScenarios;
  readonly #background: DesignBackgroundAssumptions;

  private constructor(seed: {
    readonly unit: string;
    readonly entities: DesignEntityDecls;
    readonly obligations: DesignObligations;
    readonly machines: DesignMachines;
    readonly scenarios: DesignScenarios;
    readonly background: DesignBackgroundAssumptions;
  }) {
    this.#unit = seed.unit;
    this.#entities = seed.entities;
    // 属性座標（`Entity.attr`）は宣言から導く——一意化し宣言順（凍結挙動）。
    const coordinates = new Set<string>();
    for (const ent of seed.entities) {
      for (const attr of ent.attributes()) coordinates.add(`${ent.name().asString()}.${attr.name().asString()}`);
    }
    this.#attrPaths = AttrPaths.of([...coordinates]);
    this.#obligations = seed.obligations;
    this.#machines = seed.machines;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: {
    readonly unit: string;
    readonly entities: DesignEntityDecls;
    readonly obligations: DesignObligations;
    readonly machines: DesignMachines;
    readonly scenarios: DesignScenarios;
    readonly background: DesignBackgroundAssumptions;
  }): DesignUnit {
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
  // 境界: lowered 文書の描画と refinement の SMT 文脈（adapter）が読む。
  entities(): DesignEntityDecls {
    return this.#entities;
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
  allTargets(): TargetIds {
    return TargetIds.reconstitute([...this.#obligations.ids(), ...this.#machines.transitionIds(), ...this.#scenarios.ids()]).sortedUniqueCanonically();
  }

  // 属性座標の宣言を引く（最初に一致した宣言——凍結挙動）。
  #attributeAt(attrPath: string): DesignAttributeDecl | null {
    for (const ent of this.#entities) {
      for (const attr of ent.attributes()) {
        if (`${ent.name().asString()}.${attr.name().asString()}` === attrPath) return attr;
      }
    }
    return null;
  }

  // 属性パスの enum 宣言値——null は「属性が見つからない／enum でない」の区別
  // （空配列と混ぜない——refinement の gap 文言の分岐が異なる）。旧 refinement
  // 自由関数 designEnumValues のメソッド化（OOUI 裁定）。判定は宣言に問う。
  declaredEnumValuesOf(attrPath: string): string[] | null {
    const values = this.#attributeAt(attrPath)?.enumStates() ?? null;
    return values === null ? null : [...values.toArray()];
  }

  // 属性パスの enum 宣言値（未宣言・非 enum は空）。旧 enumValuesOf の逐語移植。
  enumValuesOf(attrPath: string): string[] {
    return this.declaredEnumValuesOf(attrPath) ?? [];
  }
}
