import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { BindingDeclaration } from "./binding-declaration.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
import type { IterableFirstClassCollection } from "./iterable-first-class-collection.ts";

// 診断用の束縛宣言列。宣言順序を保ち、入力側に配列の所有権を残さない。
export class DeclaredBindings implements FirstClassCollection, IterableFirstClassCollection<BindingDeclaration> {
  readonly #values: readonly BindingDeclaration[];

  /** 1シナリオの宣言数の処理予算は10,000件。 */
  private constructor(values: readonly BindingDeclaration[]) {
    if (values.length > 10_000)
      throw new IllegalArgumentException({ kind: "too-many-binding-declarations", raw: values.length });
    this.#values = Object.freeze([...values]);
  }

  static parse(values: readonly BindingDeclaration[]): Result<DeclaredBindings, ParseError> {
    return parseConstruction(() => new DeclaredBindings(values));
  }

  static of(values: readonly BindingDeclaration[]): DeclaredBindings {
    return new DeclaredBindings(values);
  }
  add(value: BindingDeclaration): DeclaredBindings {
    return new DeclaredBindings([...this.#values, value]);
  }
  *[Symbol.iterator](): Iterator<BindingDeclaration> {
    yield* this.#values;
  }
  toArray(): readonly BindingDeclaration[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
