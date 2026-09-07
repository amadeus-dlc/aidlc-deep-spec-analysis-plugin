import {
  boundedCollectionSnapshot,
  combinedHash,
  hashOfString,
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

  protected override rebuild(values: readonly BindingDeclaration[]): DeclaredBindings {
    return new DeclaredBindings(values);
  }

  override map(transform: (element: BindingDeclaration) => BindingDeclaration): DeclaredBindings {
    return this.mapTo(transform, DeclaredBindings.of);
  }

  override combine(other: DeclaredBindings): DeclaredBindings {
    return this.combineTo(other, DeclaredBindings.of);
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
  override *[Symbol.iterator](): Iterator<BindingDeclaration> {
    yield* this.#values;
  }
  // 逐語比較。値は describe() の文字列一致で見るので、JSON のキー順まで揃わないと
  // 等しくない。要素自身の equals（Declaration の jsonEquals、キー順非依存）より
  // 厳しい関係で、IR 宣言の往復同一性を見る面が使う。
  matchesVerbatim(other: DeclaredBindings): boolean {
    if (this.count() !== other.count()) return false;
    const otherValues = other.#values;
    return !this.#values.some((binding, index) => {
      const counterpart = otherValues[index];
      return (
        counterpart === undefined ||
        !binding.path().equals(counterpart.path()) ||
        binding.value().describe() !== counterpart.value().describe()
      );
    });
  }

  // matchesVerbatim と対のハッシュ。
  verbatimHashCode(): number {
    return combinedHash(
      this.#values.map((binding) =>
        combinedHash([binding.path().hashCode(), hashOfString(binding.value().describe())]),
      ),
    );
  }

  toArray(): readonly BindingDeclaration[] {
    return this.#values;
  }

  override isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
