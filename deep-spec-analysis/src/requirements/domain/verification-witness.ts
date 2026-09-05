import type { TraceState } from "./trace-state.ts";

// 検証結果の証拠。生成済みの型付き文書を保持し、
// 入力と出力を複製して外側の変更が保存済みの証拠へ伝わるのを防ぐ。
type WitnessDocument =
  | { readonly core: string[] }
  | { readonly model: { [path: string]: boolean | number | string } }
  | { readonly verdicts: { [backend: string]: "violated" | "clean" } }
  | { readonly trace: ReturnType<TraceState["toDocument"]>[] };

export class VerificationWitness {
  readonly #document: WitnessDocument;

  private constructor(raw: WitnessDocument) {
    this.#document = structuredClone(raw);
  }

  static core(labels: readonly string[]): VerificationWitness {
    return VerificationWitness.of({ core: [...labels] });
  }

  static model(values: { [path: string]: boolean | number | string }): VerificationWitness {
    return VerificationWitness.of({ model: values });
  }

  static verdicts(byBackend: { [backend: string]: "violated" | "clean" }): VerificationWitness {
    return VerificationWitness.of({ verdicts: byBackend });
  }

  static trace(states: readonly TraceState[]): VerificationWitness {
    return VerificationWitness.of({ trace: states.map((state) => state.toDocument()) });
  }

  // 型付きの証拠を受け取る。型の実行時検査は行わない。
  static of(document: WitnessDocument): VerificationWitness { return new VerificationWitness(document); }

  toDocument(): WitnessDocument {
    return structuredClone(this.#document);
  }
}
