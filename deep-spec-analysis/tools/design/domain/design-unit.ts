// 設計 IR の 1 ユニット。rawEntities は契約3 のエンティティスキーマ断片の
// 素通し（lowering が契約1 文書へそのまま埋め込む）で、enum 値の照会だけを
// ドメインが行う。allUnitTargets / enumValuesOf は旧自由関数のメソッド化。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { DesignUnitId } from "./design-unit-id.ts";
import { IdOrder } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import { DesignMachines } from "./design-machine.ts";
import { DesignObligations } from "./design-obligation.ts";
import { DesignScenarios } from "./design-scenario.ts";
import type { DesignValue } from "./design-value.ts";

export type DesignBackgroundIdError = { readonly kind: "empty-design-background-id"; readonly raw: string };

export class DesignBackgroundId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignBackgroundId, DesignBackgroundIdError> {
    if (raw === "") return err({ kind: "empty-design-background-id", raw });
    return ok(new DesignBackgroundId(raw));
  }

  static reconstitute(raw: string): DesignBackgroundId {
    return new DesignBackgroundId(raw);
  }

  equals(other: DesignBackgroundId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

export interface DesignBackgroundAssumption {
  id: DesignBackgroundId;
  assert: Expression;
}

// 設計背景仮定のファーストクラスコレクション。
export class DesignBackgroundAssumptions {
  readonly #values: readonly DesignBackgroundAssumption[];

  private constructor(values: readonly DesignBackgroundAssumption[]) {
    this.#values = values;
  }

  static of(values: readonly DesignBackgroundAssumption[]): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...values]);
  }

  add(value: DesignBackgroundAssumption): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignBackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundAssumption[] {
    return this.#values;
  }
}

// 設計属性パス集合のファーストクラスコレクション（lowering・alpha 置換の照会面）。
export class AttrPaths {
  readonly #values: ReadonlySet<string>;

  private constructor(values: ReadonlySet<string>) {
    this.#values = values;
  }

  static of(values: readonly string[]): AttrPaths {
    return new AttrPaths(new Set(values));
  }

  add(value: string): AttrPaths {
    return new AttrPaths(new Set([...this.#values, value]));
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  has(value: string): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly string[] {
    return [...this.#values];
  }
}

export interface DesignUnitSeed {
  readonly unit: string;
  readonly rawEntities: DesignValue;
  readonly attrPaths: AttrPaths;
  readonly obligations: DesignObligations;
  readonly machines: DesignMachines;
  readonly scenarios: DesignScenarios;
  readonly background: DesignBackgroundAssumptions;
}

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

// 設計ユニットのファーストクラスコレクション。ユニット名昇順の整列
// （DesignModel の組成不変条件）という集合の知識を所有する。
export class DesignUnits {
  readonly #values: readonly DesignUnit[];

  private constructor(values: readonly DesignUnit[]) {
    this.#values = values;
  }

  static of(values: readonly DesignUnit[]): DesignUnits {
    return new DesignUnits([...values]);
  }

  add(value: DesignUnit): DesignUnits {
    return new DesignUnits([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnit> {
    yield* this.#values;
  }

  sortedByName(): DesignUnits {
    return new DesignUnits([...this.#values].sort((a, b) => (a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0)));
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly DesignUnit[] {
    return this.#values;
  }
}
