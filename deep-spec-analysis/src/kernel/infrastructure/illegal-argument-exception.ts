// コンストラクタの事前条件違反。直接生成ではそのまま送出し、入力を解析する
// 明示的な境界だけが Result に変換する。予期しない実装不具合とは区別する。
export class IllegalArgumentException extends Error {
  readonly problem: { readonly kind: string; readonly raw?: string | number };

  constructor(problem: { readonly kind: string; readonly raw?: string | number }) {
    super(`Illegal argument: ${problem.kind}`);
    this.name = "IllegalArgumentException";
    this.problem = Object.freeze({ ...problem });
  }
}
