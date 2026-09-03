// 時計ポート。予算制御（経過時間の観測）はユースケースのフロー制御だが、
// 現在時刻という環境観測は機構——ユースケースが消費する時計はポートとして
// 注入する（Date.now の直接参照は entry/adapter 限定）。

export interface Clock {
  // epoch ミリ秒。
  now(): number;
}
