import { SkipReason, type TargetIdentifiers } from "@deep-spec/kernel-domain";

import { TraceState } from "./trace-state.ts";
import type { TraceStates } from "./trace-states.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationWitness } from "./verification-witness.ts";

// 機械フェーズ（イベント機械下の到達可能な不変量違反・デッドロック探索）
// 1 回分の判定。主従の裁定（#71 波8）: 判定は命令できる抽象データ型——
// アダプタが phase 2 のガードとして kind を訊いていた「機械対象の一括 skip」
// と、interpret が kind 分岐で組み立てていた対象ごとの skip（budget 文言・
// method 別の失敗文言は golden 凍結）と witness 材料面を判定自身が所有する。
// CLI 出力・ITF という形式はアダプタが decode 済みで渡す。
export class QuintMachineRunVerdict {
  readonly #kind: "timeout" | "deadlock" | "violation" | "run-failed" | "clean";
  readonly #trace: TraceStates | null;
  readonly #outputTail: string;

  private constructor(props: {
    kind: "timeout" | "deadlock" | "violation" | "run-failed" | "clean";
    trace: TraceStates | null;
    outputTail: string;
  }) {
    this.#kind = props.kind;
    this.#trace = props.trace;
    this.#outputTail = props.outputTail;
  }

  // 予算超過——機械対象を一括 skip する。
  static timeout(): QuintMachineRunVerdict {
    return new QuintMachineRunVerdict({ kind: "timeout", trace: null, outputTail: "" });
  }

  // どのイベント規則も適用できない合法状態への到達。trace は CLI が ITF を
  // 残したときだけ（欠けは空 model の witness——凍結挙動）。
  static deadlock(trace: TraceStates | null): QuintMachineRunVerdict {
    return new QuintMachineRunVerdict({ kind: "deadlock", trace, outputTail: "" });
  }

  // 不変量違反への到達。ステップトレースは必須——最終状態で成分へ帰属する。
  static violation(trace: TraceStates): QuintMachineRunVerdict {
    return new QuintMachineRunVerdict({ kind: "violation", trace, outputTail: "" });
  }

  // CLI の予期しない失敗。outputTail は生出力尾（材料）で、凍結 detail 文言に
  // 逐語で載る。
  static runFailed(outputTail: string): QuintMachineRunVerdict {
    return new QuintMachineRunVerdict({ kind: "run-failed", trace: null, outputTail });
  }

  static clean(): QuintMachineRunVerdict {
    return new QuintMachineRunVerdict({ kind: "clean", trace: null, outputTail: "" });
  }

  // phase 2 の凍結ガード：timeout / run-failed は機械対象の義務を一括 skip
  // するので、時相フェーズはそれらを走らせない。
  abortsMachineTargets(): boolean {
    return this.#kind === "timeout" || this.#kind === "run-failed";
  }

  // 対象ごとの skip（timeout は budget 文言、run-failed は method 別の失敗
  // 文言——いずれも golden 凍結、対象の順を保つ）。deadlock / violation /
  // clean は何も skip しない。
  skipsFor(targets: TargetIdentifiers, bounded: boolean): VerificationSkipped[] {
    const kind = this.#kind;
    if (kind === "timeout") {
      return [...targets].map((target) =>
        VerificationSkipped.of({
          target,
          reason: SkipReason.of("timeout"),
          detail: "machine invariant check exceeded its budget",
        }),
      );
    }
    if (kind === "run-failed") {
      const outputTail = this.#outputTail;
      return [...targets].map((target) =>
        VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${outputTail}`,
        }),
      );
    }
    return [];
  }

  isDeadlock(): boolean {
    return this.#kind === "deadlock";
  }

  isViolation(): boolean {
    return this.#kind === "violation";
  }

  // witness 材料面：復号済みステップトレース。trace を欠く deadlock は空 model
  // へ退避する（凍結挙動）。
  witness(): VerificationWitness {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.trace(trace.toArray()) : VerificationWitness.model({});
  }

  // 帰属評価に使う最終状態（violation のトレース末尾。trace を欠けば空状態）。
  finalState(): TraceState {
    return this.#trace?.finalState() ?? TraceState.empty();
  }
}
