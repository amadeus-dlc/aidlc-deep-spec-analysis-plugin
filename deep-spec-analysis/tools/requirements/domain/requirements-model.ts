// RequirementsModel 集約 — 検証済み要件の形式モデル（契約1）のドメイン表現。
// 生 Json からの寛容な解体（欠損エントリの黙殺）はアダプタのパーサの責務で、
// ここは型付き部品を組む。クエリ（allTargets / frRefsOf / attributeAt /
// supportsMajor）は旧センサーの自由関数群を集約メソッドへ移したもの。
// 配列を生で運ばない：部品はファーストクラスコレクションで受け取り・返す。

import { type IrVersion, IdOrder } from "../../kernel/domain/index.ts";
import { type AttributeDeclaration, AttributeDeclarations } from "./attribute-declaration.ts";
import type { Expression } from "../../kernel/domain/expression.ts";
import type { FormalModelId } from "./formal-model-id.ts";
import { Obligations } from "./obligation.ts";
import { Scenarios } from "./scenario.ts";

export interface BackgroundAssumption {
  id: string;
  assert: Expression;
}

// 背景仮定のファーストクラスコレクション。
export class BackgroundAssumptions {
  readonly #values: readonly BackgroundAssumption[];

  private constructor(values: readonly BackgroundAssumption[]) {
    this.#values = values;
  }

  static of(values: readonly BackgroundAssumption[]): BackgroundAssumptions {
    return new BackgroundAssumptions([...values]);
  }

  add(value: BackgroundAssumption): BackgroundAssumptions {
    return new BackgroundAssumptions([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<BackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly BackgroundAssumption[] {
    return this.#values;
  }
}

export interface RequirementsModelSeed {
  readonly id: FormalModelId;
  readonly irVersion: IrVersion;
  readonly attributes: AttributeDeclarations;
  readonly obligations: Obligations;
  readonly scenarios: Scenarios;
  readonly background: BackgroundAssumptions;
}

export class RequirementsModel {
  readonly #id: FormalModelId;
  readonly #irVersion: IrVersion;
  readonly #attributes: AttributeDeclarations;
  readonly #obligations: Obligations;
  readonly #scenarios: Scenarios;
  readonly #background: BackgroundAssumptions;

  private constructor(seed: RequirementsModelSeed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: RequirementsModelSeed): RequirementsModel {
    return new RequirementsModel(seed);
  }

  id(): FormalModelId {
    return this.#id;
  }

  irVersion(): IrVersion {
    return this.#irVersion;
  }

  supportsMajor(major: number): boolean {
    return this.#irVersion.supportsMajor(major);
  }

  // 境界: 旧実装の major 抽出と同じ計算（verdict 文言に載る）。
  majorVersion(): number {
    return this.#irVersion.majorVersion();
  }

  attributes(): AttributeDeclarations {
    return this.#attributes;
  }

  attributeAt(path: string): AttributeDeclaration | undefined {
    return this.#attributes.byPath(path);
  }

  obligations(): Obligations {
    return this.#obligations;
  }

  scenarios(): Scenarios {
    return this.#scenarios;
  }

  background(): BackgroundAssumptions {
    return this.#background;
  }

  // 境界: 縮退文書の skip 対象列（義務 id ＋シナリオ id の昇順——凍結順）。
  allTargets(): string[] {
    return [...this.#obligations.ids(), ...this.#scenarios.ids()].sort(IdOrder.compare);
  }

  frRefsOf(targets: readonly string[]): string[] {
    const refs: string[] = [];
    for (const t of targets) {
      const ob = this.#obligations.byId(t);
      if (ob) refs.push(...ob.frRefs);
      const sc = this.#scenarios.byId(t);
      if (sc) refs.push(...sc.frRefs);
    }
    return IdOrder.sortedUnique(refs, IdOrder.compare);
  }
}
