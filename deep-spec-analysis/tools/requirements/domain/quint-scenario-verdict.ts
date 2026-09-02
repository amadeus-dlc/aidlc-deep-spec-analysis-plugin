import type { TargetId } from "../../kernel/domain/index.ts";
import { VerificationSkipped } from "./verification-skipped.ts";

// シナリオフェーズ（全属性束縛・イベントなしの 1 ステップ評価）の判定。主従の
// 裁定（#71 波21、波8 の機械判定と対）: interpret が kind 分岐で組み立てていた
// skip（budget 文言・失敗文言は golden 凍結）と「不変量に違反したか」の判定を
// 判定自身が所有する。outputTail は CLI の生出力尾（材料）で凍結 detail 文言に
// 逐語で載る。
export class QuintScenarioVerdict {
  readonly #kind: "timeout" | "run-failed" | "evaluated";
  readonly #violated: boolean;
  readonly #outputTail: string;

  private constructor(props: { kind: "timeout" | "run-failed" | "evaluated"; violated: boolean; outputTail: string }) {
    this.#kind = props.kind;
    this.#violated = props.violated;
    this.#outputTail = props.outputTail;
  }

  static timeout(): QuintScenarioVerdict {
    return new QuintScenarioVerdict({ kind: "timeout", violated: false, outputTail: "" });
  }

  static runFailed(outputTail: string): QuintScenarioVerdict {
    return new QuintScenarioVerdict({ kind: "run-failed", violated: false, outputTail });
  }

  static evaluated(violated: boolean): QuintScenarioVerdict {
    return new QuintScenarioVerdict({ kind: "evaluated", violated, outputTail: "" });
  }

  // 予算超過・実行失敗の skip（凍結文言）。evaluated は skip しない。
  skipFor(target: TargetId): VerificationSkipped | null {
    const kind = this.#kind;
    if (kind === "timeout") return VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "scenario evaluation exceeded its budget" });
    if (kind === "run-failed") return VerificationSkipped.reconstitute({ target, reason: "unavailable", detail: `quint run failed unexpectedly: ${this.#outputTail}` });
    return null;
  }

  // 評価済みの判定で不変量に違反したか（未評価は違反しない）。
  isViolated(): boolean {
    return this.#kind === "evaluated" && this.#violated;
  }
}
