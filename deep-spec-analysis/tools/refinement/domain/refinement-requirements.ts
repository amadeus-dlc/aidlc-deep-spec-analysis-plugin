// refinement が見る要件形式モデル（契約1）のビュー。requirements コンテキスト
// とは別の寛容プロファイル（background / temporal / ears を運ばない・不在や
// 不読は null）で、refinement 検査に必要な面だけを型で持つ。hash は生 IR の
// 正準 JSON の sha256（アダプタが導出）——map の requirementsIrHash と照合する
// 識別材料。

import type { Expression } from "../../kernel/domain/index.ts";

export interface RefinementAttribute {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
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

export interface RefinementScenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
}

export interface RefinementRequirementsSeed {
  readonly hash: string;
  readonly attributes: readonly RefinementAttribute[];
  readonly obligations: readonly RefinementObligation[];
  readonly scenarios: readonly RefinementScenario[];
}

export class RefinementRequirements {
  readonly #hash: string;
  readonly #attributes: readonly RefinementAttribute[];
  readonly #obligations: readonly RefinementObligation[];
  readonly #scenarios: readonly RefinementScenario[];
  readonly #obligationById: Map<string, RefinementObligation>;
  readonly #scenarioById: Map<string, RefinementScenario>;

  private constructor(seed: RefinementRequirementsSeed) {
    this.#hash = seed.hash;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#obligationById = new Map(seed.obligations.map((o) => [o.id, o]));
    this.#scenarioById = new Map(seed.scenarios.map((s) => [s.id, s]));
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: RefinementRequirementsSeed): RefinementRequirements {
    return new RefinementRequirements(seed);
  }

  // 境界: map の requirementsIrHash と照合される正準 JSON ダイジェスト。
  hash(): string {
    return this.#hash;
  }

  attributes(): readonly RefinementAttribute[] {
    return this.#attributes;
  }

  obligations(): readonly RefinementObligation[] {
    return this.#obligations;
  }

  scenarios(): readonly RefinementScenario[] {
    return this.#scenarios;
  }

  obligationById(id: string): RefinementObligation | undefined {
    return this.#obligationById.get(id);
  }

  scenarioById(id: string): RefinementScenario | undefined {
    return this.#scenarioById.get(id);
  }

  // 旧 entry の reqTargets（義務 → シナリオの宣言順・未ソート——最終文書は
  // compose が正準ソートする）。
  allTargetIds(): string[] {
    return [...this.#obligations.map((o) => o.id), ...this.#scenarios.map((s) => s.id)];
  }

  frRefsOf(id: string): string[] {
    return this.#obligationById.get(id)?.frRefs ?? this.#scenarioById.get(id)?.frRefs ?? [];
  }
}
