import type { DesignMachines } from "./design-machines.ts";
// 変換済みの義務・シナリオ・背景と元の機械を保持する。
// 帰属索引は要素と機械から導出し、追加不変量にも同じ構築契約を適用する。
// 採番・配列順は子バックエンドへの文書に影響するため維持する。

import type { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import { LoweredIdentifier } from "./lowered-identifier.ts";
import type { LoweredObligations } from "./lowered-obligations.ts";
import type { LoweredScenarios } from "./lowered-scenarios.ts";
import { LoweringIndex } from "./lowering-index.ts";
import type { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredUnitParam = {
  obligations: LoweredObligations;
  machines: DesignMachines;
  scenarios: LoweredScenarios;
  background: LoweredBackgrounds;
};

export class LoweredUnit {
  readonly #obligations: LoweredObligations;
  readonly #machines: DesignMachines;
  readonly #scenarios: LoweredScenarios;
  readonly #background: LoweredBackgrounds;
  readonly #index: LoweringIndex;

  private constructor(props: LoweredUnitParam) {
    this.#obligations = props.obligations;
    this.#machines = props.machines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#index = LoweringIndex.fromLowered(props.obligations, props.scenarios, props.machines);
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
    let sequence = obligations.count();
    for (const invariant of invariants) {
      sequence += 1;
      const identifier = LoweredIdentifier.of(`OB-${sequence}`);
      obligations = obligations.add(invariant.loweredAs(identifier));
    }
    return new LoweredUnit({
      obligations,
      machines: this.#machines,
      scenarios: this.#scenarios,
      background: this.#background,
    });
  }
}
