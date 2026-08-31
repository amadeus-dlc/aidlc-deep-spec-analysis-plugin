// スキーマ属性の宣言（bool / 有界 int / enum）。逐語移動。パスと境界は
// ドメインプリミティブで運ぶ。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type AttributePathError = { readonly kind: "empty-attribute-path"; readonly raw: string };

// "Entity.attribute" 形の要件属性パス。
export class AttributePath {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<AttributePath, AttributePathError> {
    if (raw === "") return err({ kind: "empty-attribute-path", raw });
    return ok(new AttributePath(raw));
  }

  static reconstitute(raw: string): AttributePath {
    return new AttributePath(raw);
  }

  equals(other: AttributePath): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

// AttributeBound は設計 decl 束と共有するため kernel へ移設（再輸出で面を保存）。
export { type AttributeBoundError, AttributeBound } from "../../kernel/domain/attribute-bound.ts";
import { AttributeBound } from "../../kernel/domain/attribute-bound.ts";

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
  path: AttributePath;
  kind: "bool" | "int" | "enum";
  min?: AttributeBound;
  max?: AttributeBound;
  values?: AttributeValues;
}

// 属性宣言のファーストクラスコレクション。パス索引という集合の知識を所有し、
// ドメイン層に裸の配列・Map を流さない。toArray() は境界専用の脱出口。
export class AttributeDeclarations {
  readonly #values: readonly AttributeDeclaration[];
  readonly #byPath: Map<string, AttributeDeclaration>;

  private constructor(values: readonly AttributeDeclaration[]) {
    this.#values = values;
    this.#byPath = new Map(values.map((a) => [a.path.asString(), a]));
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

  // 旧センサー逐語の path 辞書順（byte-frozen）。重複 path は ir-valid の
  // duplicate-attribute 検査が表面化し、等値時に 1 を返す挙動も凍結面
  // （return 0 への正規化は重複時の安定順を変え得るため PR10 の凍結台帳で扱う）。
  sortedByPath(): AttributeDeclarations {
    return new AttributeDeclarations([...this.#values].sort((a, b) => (a.path.asString() < b.path.asString() ? -1 : 1)));
  }

  toArray(): readonly AttributeDeclaration[] {
    return this.#values;
  }
}
