import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { BindingDeclaration } from "./binding-declaration.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";

const MAX_DECLARED_BINDINGS = 10_000;

// 診断用の束縛宣言列。宣言順序を保ち、入力側に配列の所有権を残さない。
export class DeclaredBindings
  extends FirstClassCollectionBase<BindingDeclaration, DeclaredBindings>
  implements FirstClassCollection<BindingDeclaration>
{
  readonly #values: readonly BindingDeclaration[];

  /** 1シナリオの宣言数の処理予算は10,000件。 */
  private constructor(values: readonly BindingDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_DECLARED_BINDINGS, "too-many-binding-declarations");
  }

  protected rebuild(values: readonly BindingDeclaration[]): DeclaredBindings {
    return new DeclaredBindings(values);
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
