import {
  boundedCollectionSnapshot,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { AttributePath } from "./attribute-path.ts";
import type { BindingValue } from "./binding-value.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";
import type { ScenarioBinding } from "./scenario-binding.ts";

// 同一属性へ一意に値を束縛するシナリオ状態。空集合は部分束縛として有効。
export class ScenarioBindings extends FirstClassCollectionBase<ScenarioBinding, ScenarioBindings> {
  readonly #values: readonly ScenarioBinding[];

  /** 1シナリオの束縛数の処理予算は10,000件。 */
  private constructor(values: readonly ScenarioBinding[]) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 10_000, "too-many-scenario-bindings");
    const paths = new Set<string>();
    for (const binding of snapshot) {
      const path = binding.path().asString();
      if (paths.has(path)) throw new IllegalArgumentException({ kind: "duplicate-scenario-binding", raw: path });
      paths.add(path);
    }
    this.#values = snapshot;
  }

  protected override rebuild(values: readonly ScenarioBinding[]): ScenarioBindings {
    return new ScenarioBindings(values);
  }

  override *[Symbol.iterator](): Iterator<ScenarioBinding> {
    yield* this.#values;
  }

  override map(transform: (element: ScenarioBinding) => ScenarioBinding): ScenarioBindings {
    return this.mapTo(transform, ScenarioBindings.of);
  }

  override combine(other: ScenarioBindings): ScenarioBindings {
    return this.combineTo(other, ScenarioBindings.of);
  }

  static parse(values: readonly ScenarioBinding[]): Result<ScenarioBindings, ParseError> {
    return parseConstruction(() => new ScenarioBindings(values));
  }

  static of(values: readonly ScenarioBinding[]): ScenarioBindings {
    return new ScenarioBindings(values);
  }
  add(value: ScenarioBinding): ScenarioBindings {
    return new ScenarioBindings([...this.#values, value]);
  }
  has(path: AttributePath): boolean {
    return this.#values.some((binding) => binding.isFor(path));
  }
  valueAt(path: AttributePath): BindingValue | null {
    return this.#values.find((binding) => binding.isFor(path))?.value() ?? null;
  }
  covers(paths: readonly AttributePath[]): boolean {
    return paths.every((path) => this.has(path));
  }

  entriesCanonically(): readonly ScenarioBinding[] {
    return [...this.#values].sort((a, b) =>
      a.path().asString() < b.path().asString() ? -1 : a.path().asString() > b.path().asString() ? 1 : 0,
    );
  }

  toDocument(): Record<string, boolean | number | string> {
    return Object.fromEntries(
      this.entriesCanonically().map((binding) => [binding.path().asString(), binding.value().toDocument()]),
    );
  }

  override isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
