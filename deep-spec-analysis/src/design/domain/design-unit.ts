import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import {
  TargetIdentifier,
  AttributePath,
  ExpressionTree,
  FunctionalRequirementReferences,
  KeyedIndex,
  TargetIdentifiers,
  UnitName,
  type Expression,
} from "@deep-spec/kernel-domain";

// 設計 IR の 1 ユニット。rawEntities は契約3 のエンティティスキーマ断片の
// 素通し（lowering が契約1 文書へそのまま埋め込む）で、enum 値の照会だけを
// ドメインが行う。allUnitTargets / enumValuesOf は旧自由関数のメソッド化。
//
// lowering（設計ユニット＝契約3 を契約1 の要件 IR へ落とす COMPILE-DOWN
// REUSE の中核）の意味はユニット自身が所有する——OB-n / SC-n / BG-n の採番、
// event 候補の収集、合成トートロジー不変量、帰属索引の組成。各宣言の降ろし方
// はその宣言に問う（旧 buildLowering 自由関数からの移管、BR6.2）。遷移は
// state==from の暗黙ガードと state'=to の効果を持つ event 義務へ、ignores は
// 明示 no-op event へ（意図された沈黙が gap / deadlock として読まれないように）。
// 設計だけの 2 検査は合成トートロジー不変量で v1 の前件空虚クエリに相乗りする：
//   unreachable — implies(guard, true)：前件（ガード）の非充足性が死そのもの
//   redundancy  — implies(and(guardB, not(guardA)), true)：空虚性が
//                 guardB => guardA を証明し、効果が正準同一なら B は包摂される
// 合成不変量はトートロジーなので、大域・gap・シナリオの判定を変えない。
// OB-n / SC-n / BG-n の採番・整列順は文書バイト（子の処理順）に効く凍結面。

import { DesignUnitIdentifier } from "./design-unit-identifier.ts";

import { DesignMachines } from "./design-machines.ts";
import { DesignObligations } from "./design-obligations.ts";
import { DesignScenarios } from "./design-scenarios.ts";
import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
import type { DesignEntityDeclarations } from "./design-entity-declarations.ts";
import { AttributePaths } from "./attribute-paths.ts";
import { DesignBackgroundAssumptions } from "./design-background-assumptions.ts";
import type { DesignMachine } from "./design-machine.ts";
import type { DesignMachineIdentifier } from "./design-machine-identifier.ts";
import type { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";
import type { DesignTransitionIdentifier } from "./design-transition-identifier.ts";
import type { LoweredBackground } from "./lowered-background.ts";
import { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import { LoweredIdentifier } from "./lowered-identifier.ts";
import { LoweredObligation } from "./lowered-obligation.ts";
import { LoweredObligations } from "./lowered-obligations.ts";
import { LoweredOrigin } from "./lowered-origin.ts";
import { LoweredOriginReference } from "./lowered-origin-reference.ts";
import type { LoweredScenario } from "./lowered-scenario.ts";
import { LoweredScenarios } from "./lowered-scenarios.ts";
import { LoweredUnit } from "./lowered-unit.ts";
import { LoweringIndex } from "./lowering-index.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignUnitParam = {
  readonly unit: string;
  readonly entities: DesignEntityDeclarations;
  readonly obligations: DesignObligations;
  readonly machines: DesignMachines;
  readonly scenarios: DesignScenarios;
  readonly background: DesignBackgroundAssumptions;
};

export class DesignUnit {
  readonly #unit: UnitName;
  // 契約3 の実体宣言（型付き）。属性座標と enum 宣言値はここから答える。
  readonly #entities: DesignEntityDeclarations;
  readonly #attrPaths: AttributePaths;
  readonly #obligations: DesignObligations;
  readonly #machines: DesignMachines;
  readonly #scenarios: DesignScenarios;
  readonly #background: DesignBackgroundAssumptions;

  private constructor(seed: DesignUnitParam) {
    this.#unit = UnitName.of(seed.unit);
    this.#entities = seed.entities;
    // 属性座標（`Entity.attr`）は宣言から導く——一意化し宣言順（凍結挙動）。
    const coordinates = new Set<string>();
    for (const ent of seed.entities) {
      for (const attr of ent.attributes()) coordinates.add(`${ent.name().asString()}.${attr.name().asString()}`);
    }
    this.#attrPaths = AttributePaths.of([...coordinates].map((path) => AttributePath.of(path)));
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
    return this.#entities;
  }

  attrPaths(): AttributePaths {
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
  allTargets(): TargetIdentifiers {
    return TargetIdentifiers.of(Array.from([...this.#obligations.ids(), ...this.#machines.transitionIds(), ...this.#scenarios.ids()], (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically();
  }

  // このユニットの lowering。synthetics は設計だけの 2 検査（到達不能・包摂）を
  // 前件空虚クエリへ相乗りさせる合成トートロジーの生成可否（SMT のみ true）。
  lowered(opts: { synthetics: boolean }): LoweredUnit {
    // 同トリガ・正準同一効果の包摂を測るための event 候補。この 1 手順の内側
    // だけで生きる門の署名で、ドメインオブジェクトではない（旧 buildLowering
    // の EventCandidate の逐語移管）。
    interface EventCandidate {
      design: string;
      trigger: string;
      guard: Expression;
      effect: Expression;
    }

    const obligations: LoweredObligation[] = [];
    const origins: (readonly [LoweredIdentifier, LoweredOrigin])[] = [];
    const machinesByTransition: (readonly [DesignTransitionIdentifier, DesignMachine])[] = [];
    const attrPathsByMachine: (readonly [DesignMachineIdentifier, AttributePath])[] = [];
    const candidates: EventCandidate[] = [];
    let n = 0;
    const nextId = (): LoweredIdentifier => {
      n += 1;
      return LoweredIdentifier.of(`OB-${n}`);
    };

    // 1) 設計義務は素通し（frRefs は帰属のため保持。空の frRefs は lowered
    //    文書で適法——v1 バックエンドは frRefs を不透明な帰属文字列として扱う）。
    for (const ob of this.#obligations.sortedCanonically()) {
      const id = nextId();
      obligations.push(ob.loweredAs(id));
      origins.push([id, ob.loweredOrigin()]);
      const event = ob.eventDefinition();
      if (event !== null) {
        candidates.push({ design: ob.id().asString(), trigger: event.trigger.asString(), guard: event.guard, effect: event.effect });
      }
    }

    // 2) 状態機械のコンパイルダウン：遷移 → 暗黙ガード・効果つき event 義務、
    //    ignores → 明示 no-op event。降ろし方は遷移／ignore 自身が知っている。
    for (const sm of this.#machines.sortedCanonically()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      attrPathsByMachine.push([sm.id(), AttributePath.of(attrPath)]);
      for (const tr of sm.transitions().sortedCanonically()) {
        const id = nextId();
        obligations.push(tr.loweredAs(id, attrPath));
        origins.push([id, tr.loweredOrigin()]);
        machinesByTransition.push([tr.id(), sm]);
        candidates.push({ design: tr.id().asString(), trigger: tr.trigger().asString(), guard: tr.loweredGuard(attrPath), effect: tr.loweredEffect(attrPath) });
      }
      for (const ig of sm.ignores().sortedByStateTrigger()) {
        const id = nextId();
        obligations.push(ig.loweredAs(id, attrPath));
        origins.push([id, sm.loweredIgnoreOrigin()]);
      }
    }

    // 3) 合成トートロジー（SMT lowering のみ）：死ガードと包摂が v1 の前件
    //    空虚検査に相乗りする。
    if (opts.synthetics) {
      for (const c of candidates) {
        const id = nextId();
        obligations.push(LoweredObligation.of({ id, nature: "invariant", functionalRequirementReferences: FunctionalRequirementReferences.of([]), assert: { op: "implies", args: [c.guard, { op: "bool", value: true }] } }));
        origins.push([id, LoweredOrigin.of({ design: LoweredOriginReference.of(c.design), kind: "vac-dead" })]);
      }
      const byTrigger = new Map<string, EventCandidate[]>();
      for (const c of candidates) {
        const list = byTrigger.get(c.trigger) ?? [];
        list.push(c);
        byTrigger.set(c.trigger, list);
      }
      for (const trigger of [...byTrigger.keys()].sort()) {
        const list = byTrigger.get(trigger) ?? [];
        for (const a of list) {
          for (const b of list) {
            if (a === b) continue;
            if (!ExpressionTree.of(a.effect).isCanonicallyEqual(ExpressionTree.of(b.effect))) continue;
            // (guardB and not guardA) の空虚性は guardB => guardA を証明する：
            // b は a に包摂される（同トリガ・証明可能に狭いガード・同一効果）。
            const id = nextId();
            obligations.push(LoweredObligation.of({
              id,
              nature: "invariant",
              functionalRequirementReferences: FunctionalRequirementReferences.of([]),
              assert: {
                op: "implies",
                args: [{ op: "and", args: [b.guard, { op: "not", args: [a.guard] }] }, { op: "bool", value: true }],
              },
            }));
            origins.push([id, LoweredOrigin.of({
              design: LoweredOriginReference.of(`${a.design}|${b.design}`),
              kind: "vac-shadow",
              pair: [LoweredOriginReference.of(a.design), LoweredOriginReference.of(b.design)],
            })]);
          }
        }
      }
    }

    // 4) シナリオと背景。
    const scenarios: LoweredScenario[] = [];
    const scenarioDesignIds: (readonly [LoweredIdentifier, DesignScenarioIdentifier])[] = [];
    let scN = 0;
    for (const sc of this.#scenarios.sortedCanonically()) {
      scN += 1;
      const id = LoweredIdentifier.of(`SC-${scN}`);
      scenarios.push(sc.loweredAs(id));
      scenarioDesignIds.push([id, sc.id()]);
    }
    const background: LoweredBackground[] = [];
    let bgN = 0;
    for (const bg of this.#background.sortedCanonically()) {
      bgN += 1;
      background.push(bg.loweredAs(LoweredIdentifier.of(`BG-${bgN}`)));
    }

    return LoweredUnit.of({
      obligations: LoweredObligations.of(obligations),
      scenarios: LoweredScenarios.of(scenarios),
      background: LoweredBackgrounds.of(background),
      index: LoweringIndex.of({
        origins: KeyedIndex.of(origins),
        scenarioDesignIds: KeyedIndex.of(scenarioDesignIds),
        machinesByTransition: KeyedIndex.of(machinesByTransition),
        attrPathsByMachine: KeyedIndex.of(attrPathsByMachine),
      }),
    });
  }

  // 属性座標の宣言を引く（最初に一致した宣言——凍結挙動）。
  #attributeAt(attrPath: string): DesignAttributeDeclaration | null {
    for (const ent of this.#entities) {
      for (const attr of ent.attributes()) {
        if (`${ent.name().asString()}.${attr.name().asString()}` === attrPath) return attr;
      }
    }
    return null;
  }

  // 属性パスの enum 宣言値——null は「属性が見つからない／enum でない」の区別
  // （空配列と混ぜない——refinement の gap 文言の分岐が異なる）。旧 refinement
  // 自由関数 designEnumValues のメソッド化（OOUI 裁定）。判定は宣言に問う。
  declaredEnumValuesOf(attrPath: string): string[] | null {
    const values = this.#attributeAt(attrPath)?.enumStates() ?? null;
    return values === null ? null : values.toArray().map((member) => member.asString());
  }

  // 属性パスの enum 宣言値（未宣言・非 enum は空）。旧 enumValuesOf の逐語移植。
  enumValuesOf(attrPath: string): string[] {
    return this.declaredEnumValuesOf(attrPath) ?? [];
  }
}
