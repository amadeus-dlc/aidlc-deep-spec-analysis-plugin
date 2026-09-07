import {
  FindingKind,
  FindingTargets,
  SkipReason,
  type TargetIdentifiers,
  type VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import { err, ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { ObligationIdentifiers } from "./obligation-identifiers.ts";
import type { QuintMachineComponents } from "./quint-machine-components.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import { TraceState } from "./trace-state.ts";
import type { TraceStates } from "./trace-states.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";
import { VerificationWitness } from "./verification-witness.ts";

// 機械フェーズ（イベント機械下の到達可能な不変量違反・デッドロック探索）
// 1 回分の判定。主従の裁定（#71 波8）: 判定は命令できる抽象データ型——
// アダプタが phase 2 のガードとして kind を訊いていた「機械対象の一括 skip」
// と、interpret が kind 分岐で組み立てていた対象ごとの skip（budget 文言・
// method 別の失敗文言は golden 凍結）と witness 材料面を判定自身が所有する。
// CLI 出力・ITF という形式はアダプタが decode 済みで渡す。
export class QuintMachineRunVerdict {
  readonly #kind: "missing" | "timeout" | "deadlock" | "violation" | "run-failed" | "clean";
  readonly #trace: TraceStates | null;
  readonly #outputTail: string;

  private constructor(props: {
    kind: "missing" | "timeout" | "deadlock" | "violation" | "run-failed" | "clean";
    trace: TraceStates | null;
    outputTail: string;
  }) {
    this.#kind = props.kind;
    this.#trace = props.trace;
    this.#outputTail = props.outputTail;
  }

  static missing(): QuintMachineRunVerdict {
    return new QuintMachineRunVerdict({ kind: "missing", trace: null, outputTail: "" });
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
  skipsFor(targets: TargetIdentifiers, bounded: boolean): VerificationSkips {
    const kind = this.#kind;
    if (kind === "missing")
      return VerificationSkips.coveringAll(
        targets,
        SkipReason.unavailable(),
        "quint returned no machine run: the event machine was not decided",
      );
    if (kind === "timeout")
      return VerificationSkips.coveringAll(
        targets,
        SkipReason.of("timeout"),
        "machine invariant check exceeded its budget",
      );
    if (kind === "run-failed")
      return VerificationSkips.coveringAll(
        targets,
        SkipReason.of("unavailable"),
        `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${this.#outputTail}`,
      );
    return VerificationSkips.of([]);
  }

  interpret(
    model: RequirementsModel,
    components: QuintMachineComponents,
    events: ObligationIdentifiers,
    method: VerificationMethod,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const findings: VerificationFinding[] = [];
    const machineTargets = components.ids().toTargetIds().combine(events.toTargetIds()).sortedUniqueCanonically();
    const eventTargets = events.toTargetIds();
    if (this.isDeadlock()) {
      const [head, ...tail] = events.isEmpty() ? machineTargets : eventTargets.sortedCanonically();
      if (head === undefined) return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok) return parsedTargets;
      findings.push(
        VerificationFinding.of({
          kind: FindingKind.completenessGap(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(eventTargets),
          targets: parsedTargets.value,
          witness: this.witness(),
          detail:
            "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
        }),
      );
    } else if (this.isViolation()) {
      const violatedComponents = components.violatedBy(this.finalState());
      const targets = violatedComponents.isEmpty()
        ? eventTargets.sortedCanonically()
        : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
      const [head, ...tail] = targets;
      if (head === undefined) return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok) return parsedTargets;
      findings.push(
        VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(
            targets.combine(eventTargets).sortedUniqueCanonically(),
          ),
          targets: parsedTargets.value,
          witness: this.witness(),
          detail: `The event machine can reach a state that violates ${targets.joined(", ")} (step trace attached): the event rules do not preserve the obligation.`,
        }),
      );
    }
    return ok({
      findings: VerificationFindings.of(findings),
      skipped: this.skipsFor(machineTargets, method.isBounded()),
    });
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
    return trace !== null ? VerificationWitness.traceOf(trace) : VerificationWitness.model({});
  }

  // 帰属評価に使う最終状態（violation のトレース末尾。trace を欠けば空状態）。
  finalState(): TraceState {
    return this.#trace?.finalState() ?? TraceState.empty();
  }
}
