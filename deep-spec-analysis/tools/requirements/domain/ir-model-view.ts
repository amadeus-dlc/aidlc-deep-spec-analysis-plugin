// 契約1 IR の well-formedness 検査材料。スキーマ検証を通過した IR を、
// アダプタの寛容パースが型付きに解体したもの——「Json をどう読むか」は
// アダプタの知識で、ここには構造だけが残る。
//
// 旧 ir-valid センサーのローカル semanticErrors が生 Json を直接走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移り、ここに来る
// 時点で型は確定している。エラー文言と発生順序は観測面なので凍結。

import type { Expression } from "../../kernel/domain/index.ts";

// 型宣言が欠けた属性は kind: "" として届く（旧実装は type 欠落でも属性を
// カタログへ登録した——参照解決の可否がそれで変わるため保存する）。
export interface IrAttributeView {
  readonly name: string;
  readonly kind: string;
  readonly values?: readonly string[];
  readonly min?: number;
  readonly max?: number;
}

export interface IrEntityView {
  readonly name: string;
  readonly attributes: readonly IrAttributeView[];
}

export interface IrTemporalView {
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
}

export interface IrObligationView {
  readonly id: string;
  readonly assert?: Expression;
  readonly guard?: Expression;
  readonly effect?: Expression;
  readonly temporal?: IrTemporalView;
}

// bindings は宣言順を保つ組の列（Object.entries の順序がエラー順序に出る）。
// 値は契約1 が許す JSON 値そのもので、型不一致の報告に JSON.stringify で
// 現れるため素の値のまま運ぶ。
export interface IrScenarioView {
  readonly id: string;
  readonly bindings: readonly (readonly [string, unknown])[];
  readonly hasEvent: boolean;
  readonly expect?: Expression;
}

export interface IrBackgroundView {
  readonly id: string;
  readonly assert?: Expression;
}

export interface IrModelView {
  readonly entities: readonly IrEntityView[];
  readonly obligations: readonly IrObligationView[];
  readonly scenarios: readonly IrScenarioView[];
  readonly background: readonly IrBackgroundView[];
}
