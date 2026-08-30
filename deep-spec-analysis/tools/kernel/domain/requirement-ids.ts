// requirements.md 中の FR/NFR id 抽出（frRefs 逆検証の語彙）。抽出集合は
// ファーストクラスコレクション RequirementIds として運ぶ——ドメイン層に
// 裸の Set を流さない。抽出は regex 保証で常に正な id 形。

export class RequirementIds {
  readonly #values: ReadonlySet<string>;

  private constructor(values: ReadonlySet<string>) {
    this.#values = values;
  }

  static extractFrom(text: string): RequirementIds {
    const ids = new Set<string>();
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.add(m[0]);
    }
    return new RequirementIds(ids);
  }

  static of(values: readonly string[]): RequirementIds {
    return new RequirementIds(new Set(values));
  }

  add(value: string): RequirementIds {
    return new RequirementIds(new Set([...this.#values, value]));
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  has(value: string): boolean {
    return this.#values.has(value);
  }

  // 境界: 描画・アダプタ専用。
  toArray(): readonly string[] {
    return [...this.#values];
  }
}

// 旧 API — 全消費側が RequirementIds へ移行済みのため、抽出はクラスが唯一の口。
export function requirementIds(text: string): RequirementIds {
  return RequirementIds.extractFrom(text);
}
