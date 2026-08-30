// refinement が見る要件形式モデル（契約1）のビュー。requirements コンテキスト
// とは別の寛容プロファイル（background / temporal / ears を運ばない・不在や
// 不読は null）で、refinement 検査に必要な面だけを型で持つ。hash は生 IR の
// 正準 JSON の sha256（アダプタが導出）——map の requirementsIrHash と照合する
// 識別材料。集まりはファーストクラスコレクションで運ぶ。

import type { FormalModelId } from "../../requirements/domain/index.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import { idCompare } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";

// enum 属性の宣言値のコレクション（宣言順を保持——decode の序数対応に効く）。
export class ReqAttributeValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): ReqAttributeValues {
    return new ReqAttributeValues([...values]);
  }

  add(value: string): ReqAttributeValues {
    return new ReqAttributeValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.includes(value);
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

export interface RefinementAttribute {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: ReqAttributeValues;
}

// 要件属性のファーストクラスコレクション。path 索引は旧 new Map(...) の
// 凍結挙動どおり重複 path は最後の宣言が勝つ。
export class RefinementAttributes {
  readonly #values: readonly RefinementAttribute[];

  private constructor(values: readonly RefinementAttribute[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementAttribute[]): RefinementAttributes {
    return new RefinementAttributes([...values]);
  }

  add(value: RefinementAttribute): RefinementAttributes {
    return new RefinementAttributes([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementAttribute> {
    yield* this.#values;
  }

  byPath(path: string): RefinementAttribute | undefined {
    let found: RefinementAttribute | undefined;
    for (const a of this.#values) {
      if (a.path === path) found = a;
    }
    return found;
  }

  covers(path: string): boolean {
    return this.#values.some((a) => a.path === path);
  }

  // 閉包検査・フレーム構築の走査順（path の辞書順）はコレクション知識。
  sortedByPath(): RefinementAttributes {
    return new RefinementAttributes([...this.#values].sort((x, y) => (x.path < y.path ? -1 : 1)));
  }

  toArray(): readonly RefinementAttribute[] {
    return this.#values;
  }
}

export interface RefinementObligation {
  id: string;
  nature: string;
  frRefs: string[];
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
}

// 要件義務のファーストクラスコレクション。id 索引は最後の宣言が勝つ
// （旧 new Map(...) の凍結挙動）。
export class RefinementObligations {
  readonly #values: readonly RefinementObligation[];

  private constructor(values: readonly RefinementObligation[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementObligation[]): RefinementObligations {
    return new RefinementObligations([...values]);
  }

  add(value: RefinementObligation): RefinementObligations {
    return new RefinementObligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementObligation> {
    yield* this.#values;
  }

  byId(id: string): RefinementObligation | undefined {
    let found: RefinementObligation | undefined;
    for (const o of this.#values) {
      if (o.id === id) found = o;
    }
    return found;
  }

  sortedCanonically(): RefinementObligations {
    return new RefinementObligations([...this.#values].sort((a, b) => idCompare(a.id, b.id)));
  }

  toArray(): readonly RefinementObligation[] {
    return this.#values;
  }
}

export interface RefinementScenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
}

// 要件シナリオのファーストクラスコレクション。id 索引は最後の宣言が勝つ。
export class RefinementScenarios {
  readonly #values: readonly RefinementScenario[];

  private constructor(values: readonly RefinementScenario[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementScenario[]): RefinementScenarios {
    return new RefinementScenarios([...values]);
  }

  add(value: RefinementScenario): RefinementScenarios {
    return new RefinementScenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementScenario> {
    yield* this.#values;
  }

  byId(id: string): RefinementScenario | undefined {
    let found: RefinementScenario | undefined;
    for (const s of this.#values) {
      if (s.id === id) found = s;
    }
    return found;
  }

  toArray(): readonly RefinementScenario[] {
    return this.#values;
  }
}

export interface RefinementRequirementsSeed {
  readonly id: FormalModelId;
  readonly hash: ContentHash;
  readonly attributes: RefinementAttributes;
  readonly obligations: RefinementObligations;
  readonly scenarios: RefinementScenarios;
}

export class RefinementRequirements {
  readonly #id: FormalModelId;
  readonly #hash: ContentHash;
  readonly #attributes: RefinementAttributes;
  readonly #obligations: RefinementObligations;
  readonly #scenarios: RefinementScenarios;

  private constructor(seed: RefinementRequirementsSeed) {
    this.#id = seed.id;
    this.#hash = seed.hash;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: RefinementRequirementsSeed): RefinementRequirements {
    return new RefinementRequirements(seed);
  }

  // 境界: map の requirementsIrHash と照合される正準 JSON ダイジェスト。
  id(): FormalModelId {
    return this.#id;
  }

  hash(): ContentHash {
    return this.#hash;
  }

  attributes(): RefinementAttributes {
    return this.#attributes;
  }

  obligations(): RefinementObligations {
    return this.#obligations;
  }

  scenarios(): RefinementScenarios {
    return this.#scenarios;
  }

  obligationById(id: string): RefinementObligation | undefined {
    return this.#obligations.byId(id);
  }

  scenarioById(id: string): RefinementScenario | undefined {
    return this.#scenarios.byId(id);
  }

  // 旧 entry の reqTargets（義務 → シナリオの宣言順・未ソート——最終文書は
  // compose が正準ソートする）。
  allTargetIds(): string[] {
    return [...this.#obligations.toArray().map((o) => o.id), ...this.#scenarios.toArray().map((s) => s.id)];
  }

  frRefsOf(id: string): string[] {
    return this.#obligations.byId(id)?.frRefs ?? this.#scenarios.byId(id)?.frRefs ?? [];
  }
}
