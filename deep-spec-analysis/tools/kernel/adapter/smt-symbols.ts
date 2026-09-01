// SMT-LIB 描画語彙 — v1 計画ビルダ（requirements/adapter/smt-plan）と第 2
// （refinement）コンパイラ（design/adapter/refinement-query-plan）が共有する
// シンボル・リテラル符号化とその復号。両者のスクリプトバイトはキャラクタ
// ライゼーションスナップショット（tests/fixtures/smt-scripts/）と golden が
// 凍結しており、単一定義が lockstep を構造保証する（eqRef 前例——移行 PR8
// 裁定）。式コンパイラ本体は文脈別の 2 命名（smtOf / smtOfExpr）のまま：
// ref の解決表と bare-enum 文言が文脈ごとに凍結されているため統一しない。

export function smtVar(path: string, primed: boolean): string {
  return `${primed ? "p" : "v"}_${path.replace(/\./g, "_")}`;
}

// SMT シンボル正規化（境界描画・逐語）。
export function smtName(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

// SMT-LIB の整数リテラル描画（負数は (- n) 形——境界描画・逐語）。安全整数
// 範囲内は従来とバイト同一。範囲外の整数（1e21 等——double としては正確）は
// String(n) が "1e+21" と指数表記に落ちて SMT-LIB 数字列でなくなるため、
// BigInt 経由で正確な十進を描画する（凍結解除 #34 項 4）。非整数は呼び手の
// ガードが凍結文言で弾く——ここでは従来描画を保存する。
export function smtLit(n: number): string {
  if (!Number.isInteger(n)) return n < 0 ? `(- ${-n})` : String(n);
  return n < 0 ? `(- ${BigInt(-n)})` : String(BigInt(n));
}

// smtLit の逆——z3 テキストモデルの整数値の復号（(- n) 形を含む）。
export function smtIntOf(raw: string): number {
  const m = raw.match(/^\(-\s*(\d+)\)$/);
  return m ? -Number.parseInt(m[1] ?? "0", 10) : Number.parseInt(raw, 10);
}
