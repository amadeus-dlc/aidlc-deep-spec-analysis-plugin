// DesignWitness — 設計側 finding の証拠（種別規律の裁定 2、2026-09-03）。
// 契約2 の witness——unsat core のラベル列、復号済み状態モデル、バックエンド別
// 判定、pre/post のステップトレース、参照座標——のいずれか。兄弟バックエンドの
// 文書から読んだ witness は `of` で逐語に運び、`toDocument` で逐語に
// 降りる（旧 DesignValue の素通し面を値オブジェクトが引き受ける）。core の
// ラベル書き換え（lowered id → design id）は witness 自身の知識で、形の判定
// （`core` を持つか、ラベルが文字列か）は値の内側にだけある。

type WitnessDocument = null | boolean | number | string | readonly WitnessDocument[] | { readonly [k: string]: WitnessDocument };

export class DesignWitness {
  readonly #document: WitnessDocument;

  private constructor(document: WitnessDocument) {
    this.#document = structuredClone(document);
  }

  static core(labels: readonly string[]): DesignWitness {
    return new DesignWitness({ core: [...labels] });
  }

  static model(values: { readonly [path: string]: boolean | number | string }): DesignWitness {
    return new DesignWitness({ model: { ...values } });
  }

  static verdicts(byBackend: { readonly [backend: string]: "violated" | "clean" }): DesignWitness {
    return new DesignWitness({ verdicts: { ...byBackend } });
  }

  static trace(states: readonly { readonly [path: string]: boolean | number | string }[]): DesignWitness {
    return new DesignWitness({ trace: states.map((state) => ({ ...state })) });
  }

  static refs(entries: readonly { readonly artifact: string; readonly element: string }[]): DesignWitness {
    return new DesignWitness({ refs: entries.map((entry) => ({ artifact: entry.artifact, element: entry.element })) });
  }

  // 兄弟文書と生成済みレポートから型付きの証拠を構築する。
  static of(raw: WitnessDocument): DesignWitness {
    return new DesignWitness(raw);
  }

  // unsat core（`{ core: [...] }`）の形なら core のラベルだけを書き換えて返し、
  // それ以外の witness はそのまま運ぶ（凍結挙動）。
  remapCore(rewrite: (label: string) => string): DesignWitness {
    const document = this.#document;
    if (document !== null && typeof document === "object" && !Array.isArray(document) && "core" in document) {
      const core = document.core ?? null;
      const remapped = Array.isArray(core) ? core.map((label) => (typeof label === "string" ? rewrite(label) : label)) : core;
      return new DesignWitness({ core: remapped });
    }
    return this;
  }

  // 到達の証拠はトレースの末尾にある。欠けた証拠から到達・非到達を推測しない。
  reachesState(attrPath: string, state: string): boolean {
    const document = this.#document;
    if (document === null || typeof document !== "object" || !("trace" in document)) return false;
    const trace = document.trace;
    if (!Array.isArray(trace)) return false;
    const last = trace[trace.length - 1];
    return last !== null && typeof last === "object" && !Array.isArray(last) && last[attrPath] === state;
  }

  // 境界: findings 文書へ逐語に降りる。
  toDocument(): WitnessDocument {
    return structuredClone(this.#document);
  }
}
