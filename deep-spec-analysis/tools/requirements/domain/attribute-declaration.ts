// スキーマ属性の宣言（bool / 有界 int / enum）。逐語移動。

// enum 宣言値のファーストクラスコレクション。宣言順＝SMT の序数符号化・
// Quint の集合リテラル順という凍結面なので順序を所有する。
export class AttributeValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): AttributeValues {
    return new AttributeValues([...values]);
  }

  add(value: string): AttributeValues {
    return new AttributeValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  indexOf(value: string): number {
    return this.#values.indexOf(value);
  }

  valueAt(index: number): string | undefined {
    return this.#values[index];
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

export interface AttributeDeclaration {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: AttributeValues;
}

// 属性宣言のファーストクラスコレクション。パス索引という集合の知識を所有し、
// ドメイン層に裸の配列・Map を流さない。toArray() は境界専用の脱出口。
export class AttributeDeclarations {
  readonly #values: readonly AttributeDeclaration[];
  readonly #byPath: Map<string, AttributeDeclaration>;

  private constructor(values: readonly AttributeDeclaration[]) {
    this.#values = values;
    this.#byPath = new Map(values.map((a) => [a.path, a]));
  }

  static of(values: readonly AttributeDeclaration[]): AttributeDeclarations {
    return new AttributeDeclarations([...values]);
  }

  add(value: AttributeDeclaration): AttributeDeclarations {
    return new AttributeDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeDeclaration> {
    yield* this.#values;
  }

  byPath(path: string): AttributeDeclaration | undefined {
    return this.#byPath.get(path);
  }

  toArray(): readonly AttributeDeclaration[] {
    return this.#values;
  }
}
