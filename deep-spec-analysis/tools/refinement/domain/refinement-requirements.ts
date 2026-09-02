import { TargetIds } from "../../kernel/domain/index.ts";
// refinement が見る要件形式モデル（契約1）のビュー。requirements コンテキスト
// とは別の寛容プロファイル（background / temporal / ears を運ばない・不在や
// 不読は null）で、refinement 検査に必要な面だけを型で持つ。hash は生 IR の
// 正準 JSON の sha256（アダプタが導出）——map の requirementsIrHash と照合する
// 識別材料。集まりはファーストクラスコレクションで運ぶ。

import type { FormalModelId } from "../../requirements/domain/index.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import { RefinementAttributes } from "./refinement-attributes.ts";
import type { RefinementObligation } from "./refinement-obligation.ts";
import { RefinementObligations } from "./refinement-obligations.ts";
import type { RefinementScenario } from "./refinement-scenario.ts";
import { RefinementScenarios } from "./refinement-scenarios.ts";









export class RefinementRequirements {
  readonly #id: FormalModelId;
  readonly #hash: ContentHash;
  readonly #attributes: RefinementAttributes;
  readonly #obligations: RefinementObligations;
  readonly #scenarios: RefinementScenarios;

  private constructor(seed: {
    readonly id: FormalModelId;
    readonly hash: ContentHash;
    readonly attributes: RefinementAttributes;
    readonly obligations: RefinementObligations;
    readonly scenarios: RefinementScenarios;
  }) {
    this.#id = seed.id;
    this.#hash = seed.hash;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: {
    readonly id: FormalModelId;
    readonly hash: ContentHash;
    readonly attributes: RefinementAttributes;
    readonly obligations: RefinementObligations;
    readonly scenarios: RefinementScenarios;
  }): RefinementRequirements {
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
  allTargetIds(): TargetIds {
    return TargetIds.of([...this.#obligations.toArray().map((o) => o.id().asTargetId()), ...this.#scenarios.toArray().map((s) => s.id().asTargetId())]);
  }

  frRefsOf(id: string): readonly string[] {
    return this.#obligations.byId(id)?.frRefs().toArray() ?? this.#scenarios.byId(id)?.frRefs().toArray() ?? [];
  }
}
