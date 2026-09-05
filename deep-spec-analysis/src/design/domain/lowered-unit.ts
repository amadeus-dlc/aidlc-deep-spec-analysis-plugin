// lowering の結果（3 コレクション + 帰属索引）。lowered 値と索引の一貫性、
// および refinement 追加パスによる不変な組み直しだけを所有する（BR6.1）。
// 設計モデルからの build は `DesignUnit.lowered`（BR6.2）、兄弟バックエンド
// 判定の設計語彙への写し替えは `SiblingVerdictDocument.remapVerdicts`
// （BR6.3）が持つ——この値オブジェクトの変更理由はコレクションと索引の形
// だけである。
// OB-n / SC-n / BG-n の採番順は文書バイト（子の処理順）に効く凍結面で、
// コレクション自身が順序を保って運ぶ。

import type { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import { LoweredIdentifier } from "./lowered-identifier.ts";
import type { LoweredObligations } from "./lowered-obligations.ts";
import type { LoweredScenarios } from "./lowered-scenarios.ts";
import type { LoweringIndex } from "./lowering-index.ts";
import type { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";

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

  // 再構成口。生成時の採番はDesignUnit.lowered、追加時の採番はextendedWithが所有する。
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

  // 追加不変量を採番し、帰属索引と同時に拡張する。呼び手が二つを組み直さない。
  extendedWith(invariants: RefinementQuintInvariants): LoweredUnit {
    let obligations = this.#obligations;
    let index = this.#index;
    let sequence = obligations.count();
    for (const invariant of invariants) {
      sequence += 1;
      const identifier = LoweredIdentifier.of(`OB-${sequence}`);
      obligations = obligations.add(invariant.loweredAs(identifier));
      index = index.withPassthrough(identifier.asString(), invariant.reqId().asString());
    }
    return new LoweredUnit({ obligations, scenarios: this.#scenarios, background: this.#background, index });
  }
}
