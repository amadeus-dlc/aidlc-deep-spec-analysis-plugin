// RequirementsModel 集約 — 検証済み要件の形式モデル（契約1）のドメイン表現。
// 生 Json からの寛容な解体（欠損エントリの黙殺）はアダプタのパーサの責務で、
// ここは型付き部品を組む。クエリ（allTargets / frRefsOf / attrByPath /
// supportsMajor）は旧センサーの自由関数群を集約メソッドへ移したもの。

import type { IrVersion } from "../../kernel/domain/index.ts";
import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { AttributeDeclaration } from "./attribute-declaration.ts";
import type { Expression } from "../../kernel/domain/expression.ts";
import type { Obligation } from "./obligation.ts";
import type { Scenario } from "./scenario.ts";

export interface BackgroundAssumption {
  id: string;
  assert: Expression;
}

export interface RequirementsModelSeed {
  readonly irVersion: IrVersion;
  readonly attributes: readonly AttributeDeclaration[];
  readonly obligations: readonly Obligation[];
  readonly scenarios: readonly Scenario[];
  readonly background: readonly BackgroundAssumption[];
}

export class RequirementsModel {
  readonly #irVersion: IrVersion;
  readonly #attributes: readonly AttributeDeclaration[];
  readonly #obligations: readonly Obligation[];
  readonly #scenarios: readonly Scenario[];
  readonly #background: readonly BackgroundAssumption[];
  readonly #attrByPath: Map<string, AttributeDeclaration>;

  private constructor(seed: RequirementsModelSeed) {
    this.#irVersion = seed.irVersion;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
    this.#attrByPath = new Map(seed.attributes.map((a) => [a.path, a]));
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: RequirementsModelSeed): RequirementsModel {
    return new RequirementsModel(seed);
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

  attributes(): readonly AttributeDeclaration[] {
    return this.#attributes;
  }

  attributeAt(path: string): AttributeDeclaration | undefined {
    return this.#attrByPath.get(path);
  }

  obligations(): readonly Obligation[] {
    return this.#obligations;
  }

  scenarios(): readonly Scenario[] {
    return this.#scenarios;
  }

  background(): readonly BackgroundAssumption[] {
    return this.#background;
  }

  allTargets(): string[] {
    return [...this.#obligations.map((o) => o.id), ...this.#scenarios.map((s) => s.id)].sort(idCompare);
  }

  frRefsOf(targets: readonly string[]): string[] {
    const refs: string[] = [];
    for (const t of targets) {
      for (const ob of this.#obligations) if (ob.id === t) refs.push(...ob.frRefs);
      for (const sc of this.#scenarios) if (sc.id === t) refs.push(...sc.frRefs);
    }
    return sortedUnique(refs, idCompare);
  }
}
