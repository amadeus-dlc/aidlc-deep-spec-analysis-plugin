
// 照合トークンの運び手——DP はそのまま渡し、生パス（Expression 由来）は
// string のまま渡す。照合はコレクション自身の知識（Tell-Don't-Ask 裁定）。
export type RefTokenCarrier = string | { asString(): string };
