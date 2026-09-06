import type { DesignMachines } from "./design-machines.ts";

// 変換済みの義務・シナリオ・背景と元の機械を保持する。
// 帰属索引は要素と機械から導出し、追加不変量にも同じ構築契約を適用する。
// 採番・配列順は子バックエンドへの文書に影響するため維持する。

import { err, type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import { LoweredObligations } from "./lowered-obligations.ts";
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
    this.#index = LoweringIndex.of(props.obligations, props.scenarios, props.machines, props.background);
  }

  // 再構成口。生成時の採番はDesignUnit.lowered、追加時の採番はextendedWithが所有する。
  static of(props: LoweredUnitParam): LoweredUnit {
    return new LoweredUnit(props);
  }

  static parse(props: LoweredUnitParam): Result<LoweredUnit, ParseError> {
    return parseConstruction(() => new LoweredUnit(props));
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
  extendedWith(invariants: RefinementQuintInvariants): Result<LoweredUnit, ParseError> {
    const obligations = [...this.#obligations];
    const available = this.#index.availableObligationIdentifiers();
    for (const invariant of invariants) {
      const next = available.next();
      if (next.done) return err({ kind: "too-many-lowered-identifiers" });
      obligations.push(invariant.loweredAs(next.value));
    }
    return LoweredUnit.parse({
      obligations: LoweredObligations.of(obligations),
      machines: this.#machines,
      scenarios: this.#scenarios,
      background: this.#background,
    });
  }
}
