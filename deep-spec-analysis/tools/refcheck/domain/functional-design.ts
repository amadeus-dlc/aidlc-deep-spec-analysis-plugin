// functional-design（entities.md / rules.md / functional-spec.md）と
// 横断検査（XS）向け domain-design エンティティの型付き入力モデル。
// 解析（fence/YAML/mermaid/Json 歩き）はアダプタのパーサが行う。

// 旧実装は unique/min/max/default を生 Json のまま持ち typeof で分岐していた。
// 検査が実際に区別するのは「宣言の有無」「数値として読めるか」「文字列か」
// だけなので、その意味論を無損失に型へ写す（Json はドメインに持ち込まない）。
export interface AttrDecl {
  name: string;
  element: string;
  type: string | null;
  uniqueIsTrue: boolean;
  references: string | null;
  allowed: string[] | null;
  def: string | number | null;
  minDeclared: boolean;
  maxDeclared: boolean;
  min: number | null;
  max: number | null;
}

export interface RelDecl {
  element: string;
  from: string | null;
  to: string | null;
  cardinality: string | null;
  hasDirection: boolean;
}

export interface EntityDecl {
  name: string;
  element: string;
  attrs: AttrDecl[];
  rels: RelDecl[];
}

export interface EntitiesModel {
  entities: EntityDecl[];
  rels: RelDecl[]; // top-level relationships
  shapeErrors: { element: string; detail: string }[];
}

export type EntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly model: EntitiesModel };

export interface RuleDecl {
  id: string | null;
  element: string;
  category: string | null;
  appliesTo: string | null;
  sourceIds: string[];
  missing: string[];
}

export type RulesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "no-rules-list" }
  | { readonly kind: "extracted"; readonly rules: RuleDecl[] };

export interface StateMachineSketch {
  spec: string; // "Entity" or "Entity.attribute" from the heading
  states: string[];
  fenceLine: number;
  unsupported: string | null;
}

export type FunctionalSpecOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly machines: StateMachineSketch[] };

export interface DomainEntitySketch {
  name: string;
  component: string;
  attributes: string[];
}

export type DomainEntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly error: string }
  | { readonly kind: "extracted"; readonly entities: DomainEntitySketch[] };

// 正規化名 → { 宣言名, 属性名列 }（XS 検査が消費するユニットごとの索引）。
export type SiblingUnitEntities = Map<string, Map<string, { name: string; attrs: string[] }>>;
