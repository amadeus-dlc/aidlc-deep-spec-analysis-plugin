import {
  type AttributePath,
  FirstClassCollectionBase,
  KeyedIndex,
  type ScenarioBindings,
} from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";

// TraceState — トレースの 1 状態（属性パス → 値）の値オブジェクト（種別規律の
// 裁定 2、2026-09-03）。参照の解決（`valueAt`——無い参照は absent）は状態自身
// の知識で、評価器はこれを問うだけ。挿入順は文書のキー順（復号器のソート順、
// scenario binding の正準順）で、`toDocument` がその順で逐語に降りる。

import { boundedCollectionSnapshot } from "@deep-spec-analysis/kernel-infrastructure";
import { TraceStateEntry } from "./trace-state-entry.ts";
import { TraceValue } from "./trace-value.ts";

export class TraceState extends FirstClassCollectionBase<TraceStateEntry, TraceState> {
  readonly #values: KeyedIndex<AttributePath, TraceValue>;
  readonly #entries: readonly TraceStateEntry[];

  private constructor(entries: readonly TraceStateEntry[]) {
    super();
    const snapshot = boundedCollectionSnapshot(entries, 65_536, "too-many-trace-state-entries");
    const byPath = new Map<string, TraceStateEntry>();
    for (const entry of snapshot) byPath.set(entry.path().asString(), entry);
    this.#entries = Object.freeze([...byPath.values()]);
    this.#values = KeyedIndex.of(this.#entries.map((entry) => [entry.path(), entry.value()] as const));
  }

  protected rebuild(values: readonly TraceStateEntry[]): TraceState {
    return TraceState.of(values);
  }

  *[Symbol.iterator](): Iterator<TraceStateEntry> {
    yield* this.#entries;
  }

  static empty(): TraceState {
    return new TraceState([]);
  }

  static fromBindings(bindings: ScenarioBindings): TraceState {
    return TraceState.of(
      bindings
        .entriesCanonically()
        .map((binding) => TraceStateEntry.of(binding.path(), TraceValue.of(binding.value().toDocument()))),
    );
  }

  static parse(entries: readonly TraceStateEntry[]): Result<TraceState, ParseError> {
    return parseConstruction(() => new TraceState(entries));
  }

  static of(entries: readonly TraceStateEntry[]): TraceState {
    return new TraceState(entries);
  }

  // 参照の解決——無い参照は absent（null）。凍結挙動。
  valueAt(path: AttributePath): TraceValue {
    return this.#values.get(path) ?? TraceValue.absent();
  }

  // 境界: witness の trace 1 状態として逐語に降りる（挿入順）。
  toDocument(): { [path: string]: ReturnType<TraceValue["toDocument"]> } {
    const out: { [path: string]: ReturnType<TraceValue["toDocument"]> } = {};
    for (const [path, value] of this.#values) out[path.asString()] = value.toDocument();
    return out;
  }

  equals(other: TraceState): boolean {
    const entries = this.toArray();
    const otherEntries = other.toArray();
    return (
      entries.length === otherEntries.length &&
      entries.every((entry, index) => entry.equals(otherEntries[index] as (typeof entries)[number]))
    );
  }

  toArray(): readonly TraceStateEntry[] {
    return [...this];
  }
}
