import type { TargetId } from "@deep-spec/kernel-domain";
import type { TraceStates } from "./trace-states.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationWitness } from "./verification-witness.ts";

// 時相フェーズ（leads-to 義務 1 件の bounded 検査）の判定。主従の裁定（#71
// 波21、波8 の機械判定と対）: 判定は命令できる抽象データ型——interpret が kind
// 分岐で組み立てていた skip（budget 文言は golden 凍結）と witness 材料面を
// 判定自身が所有する。
export class QuintTemporalVerdict {
  readonly #kind: "timeout" | "run-failed" | "violation" | "clean";
  readonly #trace: TraceStates | null;
  readonly #outputTail: string;

  private constructor(props: { kind: "timeout" | "run-failed" | "violation" | "clean"; trace: TraceStates | null; outputTail: string }) {
    this.#kind = props.kind;
    this.#trace = props.trace;
    this.#outputTail = props.outputTail;
  }

  static timeout(): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "timeout", trace: null, outputTail: "" });
  }

  // 予算内で答えが返らなかった（spawn 失敗・非ゼロ終了・error 出力）。verify は
  // 違反時にだけ ITF を書くので、ITF 無しを無条件に clean と読むと失敗が pass に
  // 化ける。シナリオ判定の run-failed と同じ語彙で、outputTail は CLI の生出力尾。
  static runFailed(outputTail: string): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "run-failed", trace: null, outputTail });
  }

  // 反例トレースつきの違反（"from" に届いて "to" に届かない経路）。
  static violation(trace: TraceStates): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "violation", trace, outputTail: "" });
  }

  static clean(): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "clean", trace: null, outputTail: "" });
  }

  // 予算超過・実行失敗の skip（凍結文言）。violation / clean は skip しない。
  skipFor(target: TargetId): VerificationSkipped | null {
    const kind = this.#kind;
    if (kind === "timeout") return VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "temporal check exceeded its budget" });
    if (kind === "run-failed") return VerificationSkipped.reconstitute({ target, reason: "unavailable", detail: `quint verify failed unexpectedly: ${this.#outputTail}` });
    return null;
  }

  isViolation(): boolean {
    return this.#kind === "violation";
  }

  // witness 材料面：反例のステップトレース（欠けは空 model——凍結挙動）。
  witness(): VerificationWitness {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.trace(trace.toArray()) : VerificationWitness.model({});
  }
}
