import { TargetIdentifier, TargetIdentifiers, type UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  combinedHash,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignEventRuleCatalog } from "./design-event-rule-catalog.ts";

// 一意な属性カタログと検証対象を持つ実行用の設計ユニット。
// 各宣言、イベント規則、包摂候補へ変換を依頼し、変換順序と採番を所有する。
//
// lowering（設計ユニット＝契約3 を契約1 の要件 IR へ落とす COMPILE-DOWN
// REUSE の中核）の意味はユニット自身が所有する——OB-n / SC-n / BG-n の採番、
// event 候補の収集、合成トートロジー不変量、帰属索引の組成。各宣言の降ろし方
// はその宣言に問う。遷移は
// state==from の暗黙ガードと state'=to の効果を持つ event 義務へ、ignores は
// 明示 no-op event へ（意図された沈黙が gap / deadlock として読まれないように）。
// 設計だけの 2 検査は合成トートロジー不変量で v1 の前件空虚クエリに相乗りする：
//   unreachable — implies(guard, true)：前件（ガード）の非充足性が死そのもの
//   redundancy  — implies(and(guardB, not(guardA)), true)：空虚性が
//                 guardB => guardA を証明し、効果が正準同一なら B は包摂される
// 合成不変量はトートロジーなので、大域・gap・シナリオの判定を変えない。
// OB-n / SC-n / BG-n の採番・整列順は文書バイト（子の処理順）に効く凍結面。

import type { AttributePaths } from "./attribute-paths.ts";
import type { DesignAttributeCatalog } from "./design-attribute-catalog.ts";
import type { DesignBackgroundAssumptions } from "./design-background-assumptions.ts";
import type { DesignEntityDeclarations } from "./design-entity-declarations.ts";
import { DesignMachines } from "./design-machines.ts";
import type { DesignObligations } from "./design-obligations.ts";
import type { DesignScenarios } from "./design-scenarios.ts";
import { DesignUnitIdentifier } from "./design-unit-identifier.ts";
import type { LoweredBackground } from "./lowered-background.ts";
import { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import { LoweredIdentifier } from "./lowered-identifier.ts";
import type { LoweredObligation } from "./lowered-obligation.ts";
import { LoweredObligations } from "./lowered-obligations.ts";
import type { LoweredScenario } from "./lowered-scenario.ts";
import { LoweredScenarios } from "./lowered-scenarios.ts";
import { LoweredUnit } from "./lowered-unit.ts";
import { sameIterable } from "./value-equality.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignUnitParam = {
  readonly unit: UnitName;
  readonly catalog: DesignAttributeCatalog;
  readonly obligations: DesignObligations;
  readonly machines: DesignMachines;
  readonly scenarios: DesignScenarios;
  readonly background: DesignBackgroundAssumptions;
};

export class DesignUnit {
  readonly #unit: UnitName;
  // 契約3 の実体宣言（型付き）。属性座標と enum 宣言値はここから答える。
  readonly #catalog: DesignAttributeCatalog;
  readonly #obligations: DesignObligations;
  readonly #machines: DesignMachines;
  readonly #scenarios: DesignScenarios;
  readonly #background: DesignBackgroundAssumptions;

  private constructor(seed: DesignUnitParam) {
    const identifiers = [
      ...seed.obligations.ids(),
      ...seed.scenarios.ids(),
      ...seed.machines.transitionIds(),
      ...seed.machines.ids(),
    ];
    if (new Set(identifiers).size !== identifiers.length)
      throw new IllegalArgumentException({ kind: "duplicate-design-target" });
    this.#unit = seed.unit;
    this.#catalog = seed.catalog;
    this.#obligations = seed.obligations;
    this.#machines = seed.machines;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタのパーサが解いた型付き部品からの構築口。
  static parse(seed: DesignUnitParam): Result<DesignUnit, ParseError> {
    return parseConstruction(() => new DesignUnit(seed));
  }

  static of(seed: DesignUnitParam): DesignUnit {
    return new DesignUnit(seed);
  }

  equals(other: DesignUnit): boolean {
    return (
      this.#unit.equals(other.#unit) &&
      sameIterable(this.#catalog, other.#catalog, (left, right) => left.equals(right)) &&
      sameIterable(this.#obligations, other.#obligations, (left, right) => left.equals(right)) &&
      sameIterable(this.#machines, other.#machines, (left, right) => left.equals(right)) &&
      sameIterable(this.#scenarios, other.#scenarios, (left, right) => left.equals(right)) &&
      sameIterable(this.#background, other.#background, (left, right) => left.equals(right))
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#unit.hashCode(),
      this.#catalog.hashCode(),
      this.#obligations.hashCode(),
      this.#machines.hashCode(),
      this.#scenarios.hashCode(),
      this.#background.hashCode(),
    ]);
  }

  id(): DesignUnitIdentifier {
    return DesignUnitIdentifier.of(this.#unit.asString());
  }

  // 境界: 文書・文言に逐語で載るユニット名（恒等の値）。
  name(): string {
    return this.#unit.asString();
  }

  // 境界: lowering が契約1 文書の schema.entities へ逐語で埋め込む断片。
  // 境界: lowered 文書の描画と refinement の SMT 文脈（adapter）が読む。
  entities(): DesignEntityDeclarations {
    return this.#catalog.declarations();
  }

  attrPaths(): AttributePaths {
    return this.#catalog.paths();
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
  allTargets(): TargetIdentifiers {
    return TargetIdentifiers.of(
      Array.from([...this.#obligations.ids(), ...this.#machines.transitionIds(), ...this.#scenarios.ids()], (raw) =>
        TargetIdentifier.of(raw),
      ),
    ).sortedUniqueCanonically();
  }

  // このユニットの lowering。synthetics は設計だけの 2 検査（到達不能・包摂）を
  // 前件空虚クエリへ相乗りさせる合成トートロジーの生成可否（SMT のみ true）。
  withLowering<T>(
    options: { synthetics: boolean },
    actions: {
      failed: (problem: ParseError) => T;
      ready: (lowered: LoweredUnit) => T;
    },
  ): T {
    const result = this.lowered(options);
    return result.ok ? actions.ready(result.value) : actions.failed(result.error);
  }

  lowered(opts: { synthetics: boolean }): Result<LoweredUnit, ParseError> {
    const obligations: LoweredObligation[] = [];
    let n = 0;
    const nextId = (): LoweredIdentifier => {
      n += 1;
      return LoweredIdentifier.of(`OB-${n}`);
    };

    // 1) 設計義務は素通し（frRefs は帰属のため保持。空の frRefs は lowered
    //    文書で適法——v1 バックエンドは frRefs を不透明な帰属文字列として扱う）。
    this.#obligations.sortedCanonically().foldLeft(obligations, (acc, ob) => {
      acc.push(ob.loweredAs(nextId()));
      return acc;
    });

    // 2) 状態機械のコンパイルダウン：遷移 → 暗黙ガード・効果つき event 義務、
    //    ignores → 明示 no-op event。降ろし方は遷移／ignore 自身が知っている。
    for (const sm of this.#machines.sortedCanonically()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      for (const tr of sm.transitions().sortedCanonically()) {
        const id = nextId();
        const lowered = tr.loweredAs(id, attrPath, sm);
        if (!lowered.ok) return lowered;
        obligations.push(lowered.value);
      }
      for (const ig of sm.ignores().sortedByStateTrigger()) {
        const id = nextId();
        obligations.push(ig.loweredAs(id, attrPath, sm.loweredIgnoreOrigin()));
      }
    }

    // 3) 合成トートロジー（SMT lowering のみ）：死ガードと包摂が v1 の前件
    //    空虚検査に相乗りする。
    if (opts.synthetics) {
      const events = DesignEventRuleCatalog.parse(this);
      if (!events.ok) return events;
      for (const event of events.value) {
        const lowered = event.deadGuardProbe(nextId());
        if (!lowered.ok) return lowered;
        obligations.push(lowered.value);
      }
      for (const probe of events.value.subsumptionProbes()) {
        const lowered = probe.loweredAs(nextId());
        if (!lowered.ok) return lowered;
        obligations.push(lowered.value);
      }
    }

    // 4) シナリオと背景。
    // SC-n / BG-n の採番は整列後の位置そのもの。
    const scenarios = this.#scenarios.sortedCanonically().foldLeft<LoweredScenario[]>([], (acc, sc) => {
      acc.push(sc.loweredAs(LoweredIdentifier.of(`SC-${acc.length + 1}`)));
      return acc;
    });
    const background = this.#background.sortedCanonically().foldLeft<LoweredBackground[]>([], (acc, bg) => {
      acc.push(bg.loweredAs(LoweredIdentifier.of(`BG-${acc.length + 1}`)));
      return acc;
    });

    return LoweredUnit.parse({
      machines: this.#machines,
      obligations: LoweredObligations.of(obligations),
      scenarios: LoweredScenarios.of(scenarios),
      background: LoweredBackgrounds.of(background),
    });
  }

  // 属性パスの enum 宣言値——null は「属性が見つからない／enum でない」の区別
  // （空配列と混ぜない——refinement の gap 文言の分岐が異なる）。旧 refinement
  // 自由関数 designEnumValues のメソッド化（OOUI 裁定）。判定は宣言に問う。
  declaredEnumValuesOf(attrPath: string): string[] | null {
    const values = this.#catalog.enumValuesAt(attrPath);
    return values === null
      ? null
      : values.foldLeft<string[]>([], (acc, member) => {
          acc.push(member.asString());
          return acc;
        });
  }

  // 属性パスの enum 宣言値（未宣言・非 enum は空）。旧 enumValuesOf の逐語移植。
  enumValuesOf(attrPath: string): string[] {
    return this.declaredEnumValuesOf(attrPath) ?? [];
  }
}
