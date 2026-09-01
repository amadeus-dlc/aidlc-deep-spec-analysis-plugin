// v1 検証 finding / skip の語彙（契約2）。witness は型付きユニオン——
// unsat core のラベル列・decode 済み状態モデル・クロスチェック判定表・
// 状態機械のステップトレース。

import type { FrRefs, TargetIds } from "../../kernel/domain/index.ts";
import type { VerificationWitness } from "./verification-witness.ts";

export interface VerificationFinding {
  kind: string;
  frRefs: FrRefs;
  targets: TargetIds;
  witness: VerificationWitness;
  detail: string;
}







// finding / skip のファーストクラスコレクション。契約2 の正準ソート
// （kind 順位→targets→detail、target→reason）という集合の知識を所有する。



