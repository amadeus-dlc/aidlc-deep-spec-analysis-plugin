import type { TraceState } from "./trace-state.ts";

// 契約2 の witness——unsat core のラベル列、復号済み状態モデル、バックエンド別
// 判定、ステップトレースのいずれか。findings 文書へは自分で降りる
// （`toDocument`——中身は素通し値で逐語）。文書からの復元は旧実装の盲目
// キャスト（欠けは空 core）を凍結面として保つ。中身を覗く読み手は無く、
// 直列化と受け渡しだけが面（#71 波28）。
type WitnessDocument =
  | { readonly core: string[] }
  | { readonly model: { [path: string]: boolean | number | string } }
  | { readonly verdicts: { [backend: string]: "violated" | "clean" } }
  | { readonly trace: ReturnType<TraceState["toDocument"]>[] };

export class VerificationWitness {
  readonly #document: WitnessDocument;

  private constructor(document: WitnessDocument) {
    this.#document = document;
  }

  static core(labels: readonly string[]): VerificationWitness {
    return new VerificationWitness({ core: [...labels] });
  }

  static model(values: { [path: string]: boolean | number | string }): VerificationWitness {
    return new VerificationWitness({ model: values });
  }

  static verdicts(byBackend: { [backend: string]: "violated" | "clean" }): VerificationWitness {
    return new VerificationWitness({ verdicts: byBackend });
  }

  static trace(states: readonly TraceState[]): VerificationWitness {
    return new VerificationWitness({ trace: states.map((state) => state.toDocument()) });
  }

  static fromDocument(raw: unknown): VerificationWitness {
    return new VerificationWitness((raw ?? { core: [] }) as WitnessDocument);
  }

  toDocument(): WitnessDocument {
    return this.#document;
  }
}
