// スナップショット作成前の構築引数。型の別名であり、検証済みVOではない。
// undefinedは、型付きの公開文書が省略可能フィールドを明示した場合も保持するために含む。
export type ValueSnapshotParam =
  | undefined | null | boolean | number | string
  | readonly ValueSnapshotParam[]
  | { readonly [key: string]: ValueSnapshotParam };
