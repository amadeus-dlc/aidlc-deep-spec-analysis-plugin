// スキーマ属性の宣言（bool / 有界 int / enum）。逐語移動。

export interface AttributeDeclaration {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
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
