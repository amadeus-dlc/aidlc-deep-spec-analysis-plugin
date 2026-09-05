// lowering の結果（3 コレクション + 帰属索引）。lowered 値と索引の一貫性、
// および refinement 追加パスによる不変な組み直しだけを所有する（BR6.1）。
// 設計モデルからの build は `DesignUnit.lowered`（BR6.2）、兄弟バックエンド
// 判定の設計語彙への写し替えは `SiblingVerdictDocument.remapVerdicts`
// （BR6.3）が持つ——この値オブジェクトの変更理由はコレクションと索引の形
// だけである。
// OB-n / SC-n / BG-n の採番順は文書バイト（子の処理順）に効く凍結面で、
// コレクション自身が順序を保って運ぶ。

import type { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import type { LoweredObligations } from "./lowered-obligations.ts";
import type { LoweredScenarios } from "./lowered-scenarios.ts";
import type { LoweringIndex } from "./lowering-index.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredUnitParam = {
  obligations: LoweredObligations;
  scenarios: LoweredScenarios;
  background: LoweredBackgrounds;
  index: LoweringIndex;
};

export class LoweredUnit {
  readonly #obligations: LoweredObligations;
  readonly #scenarios: LoweredScenarios;
  readonly #background: LoweredBackgrounds;
  readonly #index: LoweringIndex;

  private constructor(props: LoweredUnitParam) {
    this.#obligations = props.obligations;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#index = props.index;
  }

  // 検証済み生成口——採番済みの lowered コレクションと、その採番に対応する
  // 帰属索引だけを受け取る（門を通るのは `DesignUnit.lowered` と `extendedWith`）。
  static of(props: LoweredUnitParam): LoweredUnit {
    return new LoweredUnit(props);
  }

  obligations(): LoweredObligations {
    return this.#obligations;
  }

  scenarios(): LoweredScenarios {
    return this.#scenarios;
  }

  background(): LoweredBackgrounds {
    return this.#background;
  }

  index(): LoweringIndex {
    return this.#index;
  }

  // refinement 追加パス：追加不変量つき義務列と拡張済み索引での組み直し。
  // シナリオと背景は追加パスで変わらないので、そのまま引き継ぐ。
  extendedWith(obligations: LoweredObligations, index: LoweringIndex): LoweredUnit {
    return new LoweredUnit({ obligations, scenarios: this.#scenarios, background: this.#background, index });
  }
}
