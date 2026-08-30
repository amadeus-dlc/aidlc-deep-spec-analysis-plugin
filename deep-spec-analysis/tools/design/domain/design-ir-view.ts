// 契約3 設計 IR の well-formedness 検査材料。スキーマ検証を通過した設計 IR を、
// アダプタの寛容パースが型付きに解体したもの。ユニットごとの BR 材料
// （construction ディレクトリの有無と rules.md 本文）も、探索と読み込みを
// 済ませた形でここに載る——ドメインは I/O を持たない。
//
// 旧 design-ir-valid センサーの semanticErrors が生 Json を走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移った。

import type { Expression } from "../../kernel/domain/index.ts";

// 型宣言が欠けた属性は kind: "" で届く（旧実装はカタログへ登録した）。
export interface DesignAttributeView {
  readonly name: string;
  readonly kind: string;
  readonly values?: readonly string[];
  readonly min?: number;
  readonly max?: number;
}

export interface DesignEntityView {
  readonly name: string;
  readonly attributes: readonly DesignAttributeView[];
}

export interface DesignTemporalView {
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
}

export interface DesignObligationView {
  readonly id: string;
  readonly origin?: string;
  // brRefs が配列でなければ undefined（origin:"rules" の必須チェックに使う）。
  readonly brRefs?: readonly string[];
  readonly assert?: Expression;
  readonly guard?: Expression;
  readonly effect?: Expression;
  readonly temporal?: DesignTemporalView;
}

export interface DesignTransitionView {
  readonly id: string;
  readonly from?: string;
  readonly to?: string;
  readonly trigger?: string;
  readonly brRefs?: readonly string[];
  readonly guard?: Expression;
  readonly effect?: Expression;
}

export interface DesignIgnoreView {
  readonly state: string;
  readonly trigger: string;
}

export interface DesignMachineView {
  readonly id: string;
  // `<entity>.<attribute>`。どちらかが文字列でなければ "?" が入る（凍結）。
  readonly attrPath: string;
  readonly initial: readonly string[];
  readonly transitions: readonly DesignTransitionView[];
  readonly ignores: readonly DesignIgnoreView[];
}

export interface DesignScenarioView {
  readonly id: string;
  readonly bindings: readonly (readonly [string, unknown])[];
  readonly hasEvent: boolean;
  readonly expect?: Expression;
  readonly brRefs?: readonly string[];
}

export interface DesignBackgroundView {
  readonly id: string;
  readonly assert?: Expression;
}

export interface DesignUnitView {
  readonly unit: string;
  readonly entities: readonly DesignEntityView[];
  readonly obligations: readonly DesignObligationView[];
  readonly stateMachines: readonly DesignMachineView[];
  readonly scenarios: readonly DesignScenarioView[];
  readonly background: readonly DesignBackgroundView[];
  readonly unformalizedTargets: readonly string[];
  // construction/<unit>/ が記録配下に存在するか（記録ルート未解決なら true 扱い
  // ——旧実装は recordRoot === null のときこの検査を出さない）。
  readonly directoryExists: boolean;
  // construction/<unit>/functional-design/rules.md の本文。無ければ null。
  readonly rulesMarkdown: string | null;
}
