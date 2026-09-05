// Result — ハウスのエラーチャネル（言語拡張：ドメインを知らない）。
// domain / usecase の予期される失敗は Result で返す。構築契約違反のpanicは捕捉しない。
// 成否の振り分けと値の合成は result-composition が担う。ユースケースは成功値を
// 解体せず、matchResultの分岐から型自身へ仕事を依頼する。

export interface ResultSuccess<T> {
  readonly ok: true;
  readonly value: T;
}
