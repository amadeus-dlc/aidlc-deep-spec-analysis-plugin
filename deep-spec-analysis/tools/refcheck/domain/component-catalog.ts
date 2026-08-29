// components.md の型付き入力モデル（domain 語彙）。
// 解析（YAML/fence 歩き）はアダプタのパーサが行い、ここは検査が消費する形。
// 旧 aidlc-sensor-deep-spec-refcheck-domain.ts からの型の逐語移動。

export interface ComponentRef {
  component: string;
  element: string;
}

export interface ComponentEntity {
  name: string;
  element: string;
  identifier: string | null;
  references: { entity: string; ownedBy: string; element: string }[];
}

export interface Component {
  name: string;
  element: string;
  dependsOn: ComponentRef[];
  dependents: ComponentRef[];
  entities: ComponentEntity[];
}

export interface ComponentShapeError {
  element: string;
  detail: string;
}

// アダプタのパーサが返す解析結果（DD-0 の判定材料まで型で運ぶ）。
export type ComponentCatalogOutcome =
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly components: Component[]; readonly shapeErrors: ComponentShapeError[] };
