import type { TargetId } from "../../kernel/domain/index.ts";
import type { TraceStates } from "./trace-states.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationWitness } from "./verification-witness.ts";

// 時相フェーズ（leads-to 義務 1 件の bounded 検査）の判定。主従の裁定（#71
// 波21、波8 の機械判定と対）: 判定は命令できる抽象データ型——interpret が kind
// 分岐で組み立てていた skip（budget 文言は golden 凍結）と witness 材料面を
// 判定自身が所有する。
export class QuintTemporalVerdict {
  readonly #kind: "timeout" | "violation" | "clean";
  readonly #trace: TraceStates | null;

  private constructor(props: { kind: "timeout" | "violation" | "clean"; trace: TraceStates | null }) {
    this.#kind = props.kind;
    this.#trace = props.trace;
  }

  static timeout(): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "timeout", trace: null });
  }

  // 反例トレースつきの違反（"from" に届いて "to" に届かない経路）。
  static violation(trace: TraceStates): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "violation", trace });
  }

  static clean(): QuintTemporalVerdict {
    return new QuintTemporalVerdict({ kind: "clean", trace: null });
  }

  // 予算超過の skip（凍結文言）。violation / clean は skip しない。
  skipFor(target: TargetId): VerificationSkipped | null {
    if (this.#kind !== "timeout") return null;
    return VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "temporal check exceeded its budget" });
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
