import type { ObligationId } from "../../requirements/domain/index.ts";
import { ScenarioId } from "../../requirements/domain/scenario-id.ts";
import { TransitionRef } from "./transition-ref.ts";

// クエリ計画の宣言（kind ごとに参照語彙が異なる閉ユニオン——invariant /
// enabledness / simulation は要件義務、scenario は要件シナリオ。simulation は
// 加えて写像先の設計参照を運ぶ）。
export type RefinementProbe =
  | { kind: "invariant"; reqId: ObligationId }
  | { kind: "enabledness"; reqId: ObligationId }
  | { kind: "simulation"; reqId: ObligationId; designId: TransitionRef }
  | { kind: "scenario"; reqId: ScenarioId };
