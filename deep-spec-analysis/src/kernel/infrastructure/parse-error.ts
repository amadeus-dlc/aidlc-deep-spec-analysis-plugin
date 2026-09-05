// 通常の値生成で扱う解析失敗。例外の継承や内部プロパティの型には依存しない。
// kindは不適合の理由、rawは診断に必要な入力または超過したサイズを表す。
export interface ParseError {
  readonly kind: string;
  readonly raw?: string | number;
}
