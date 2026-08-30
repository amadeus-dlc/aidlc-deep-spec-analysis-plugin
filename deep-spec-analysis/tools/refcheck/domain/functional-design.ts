// functional-design（entities.md / rules.md / functional-spec.md）と
// 横断検査（XS）向け domain-design エンティティの型付き入力モデル。
// 解析（fence/YAML/mermaid/Json 歩き）はアダプタのパーサが行う。

import type {
  AllowedValue,
  AppliesTo,
  AttributeDefault,
  AttributeName,
  BusinessRuleId,
  CardinalityNotation,
  ComponentName,
  ElementPath,
  EntityName,
  MachineSpec,
  NumericBound,
  ReferenceTarget,
  RuleCategory,
  SourceId,
  StateName,
  TypeName,
} from "./functional-design-values.ts";

// 旧実装は unique/min/max/default を生 Json のまま持ち typeof で分岐していた。
// 検査が区別する意味論（宣言の有無・数値か文字列か）は語彙 DP が所有し、
// bool（宣言フラグ）以外の値はすべてドメインプリミティブで運ぶ。
export interface AttrDecl {
  name: AttributeName;
  element: ElementPath;
  type: TypeName | null;
  uniqueIsTrue: boolean;
  references: ReferenceTarget | null;
  allowed: AllowedValue[] | null;
  def: AttributeDefault | null;
  minDeclared: boolean;
  maxDeclared: boolean;
  min: NumericBound | null;
  max: NumericBound | null;
}

export interface RelDecl {
  element: ElementPath;
  from: EntityName | null;
  to: EntityName | null;
  cardinality: CardinalityNotation | null;
  hasDirection: boolean;
}

export interface EntityDecl {
  name: EntityName;
  element: ElementPath;
  attrs: AttrDecl[];
  rels: RelDecl[];
}

export interface EntitiesModel {
  entities: EntityDecl[];
  rels: RelDecl[]; // top-level relationships
  shapeErrors: { element: ElementPath; detail: string }[];
}

export type EntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly model: EntitiesModel };

export interface RuleDecl {
  id: BusinessRuleId | null;
  element: ElementPath;
  category: RuleCategory | null;
  appliesTo: AppliesTo | null;
  sourceIds: SourceId[];
  // 欠落キー名の列（文言材料——語彙値ではない）。
  missing: string[];
}

export type RulesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "no-rules-list" }
  | { readonly kind: "extracted"; readonly rules: RuleDecl[] };

export interface StateMachineSketch {
  spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
  states: StateName[];
  fenceLine: number;
  unsupported: string | null; // 文言材料（理由のプローズ）
}

export type FunctionalSpecOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly machines: StateMachineSketch[] };

export interface DomainEntitySketch {
  name: EntityName;
  component: ComponentName;
  attributes: AttributeName[];
}

export type DomainEntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly error: string }
  | { readonly kind: "extracted"; readonly entities: DomainEntitySketch[] };

// 正規化名 → { 宣言名, 属性名列 }（XS 検査が消費するユニットごとの索引）。
export type SiblingUnitEntities = Map<string, Map<string, { name: EntityName; attrs: AttributeName[] }>>;
