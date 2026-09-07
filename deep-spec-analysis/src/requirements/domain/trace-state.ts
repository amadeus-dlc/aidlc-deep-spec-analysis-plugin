import {
  type AttributePath,
  FirstClassCollectionBase,
  KeyedIndex,
  type ScenarioBindings,
} from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";

// TraceState — トレースの 1 状態（属性パス → 値）の値オブジェクト（種別規律の
// 裁定 2、2026-09-03）。参照の解決（`valueAt`——無い参照は absent）は状態自身
// の知識で、評価器はこれを問うだけ。反復はキーの初出順を保つ。
// 文書化では標準のオブジェクト列挙規則に従い、整数添字のキーは数値昇順になる。

import { boundedCollectionSnapshot, combinedHash } from "@deep-spec-analysis/kernel-infrastructure";
import { TraceStateEntry } from "./trace-state-entry.ts";
import { TraceValue } from "./trace-value.ts";

export class TraceState extends FirstClassCollectionBase<TraceStateEntry, TraceState> {
  readonly #entries: KeyedIndex<AttributePath, TraceStateEntry>;

  private constructor(entries: readonly TraceStateEntry[]) {
    super();
    const snapshot = boundedCollectionSnapshot(entries, 65_536, "too-many-trace-state-entries");
    this.#entries = KeyedIndex.of(snapshot.map((entry) => [entry.path(), entry] as const));
  }

  protected override rebuild(values: readonly TraceStateEntry[]): TraceState {
    return TraceState.of(values);
  }

  override *[Symbol.iterator](): Iterator<TraceStateEntry> {
    yield* this.#entries.values();
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

  override map(transform: (element: TraceStateEntry) => TraceStateEntry): TraceState {
    return this.mapTo(transform, TraceState.of);
  }

  override combine(other: TraceState): TraceState {
    return this.combineTo(other, TraceState.of);
  }

  static parse(entries: readonly TraceStateEntry[]): Result<TraceState, ParseError> {
    return parseConstruction(() => new TraceState(entries));
  }

  static of(entries: readonly TraceStateEntry[]): TraceState {
    return new TraceState(entries);
  }

  // 参照の解決——無い参照は absent（null）。凍結挙動。
  valueAt(path: AttributePath): TraceValue {
    return this.#entries.get(path)?.value() ?? TraceValue.absent();
  }

  // 境界: witness のtrace状態へ、既存のオブジェクト列挙規則で出力する。
  toDocument(): { [path: string]: ReturnType<TraceValue["toDocument"]> } {
    return Object.fromEntries([...this.#entries].map(([path, entry]) => [path.asString(), entry.value().toDocument()]));
  }

  override equals(other: TraceState): boolean {
    if (this.#entries.size() !== other.#entries.size()) return false;
    for (const [path, entry] of this.#entries) {
      const otherEntry = other.#entries.get(path);
      if (otherEntry === undefined || !entry.value().equals(otherEntry.value())) return false;
    }
    return true;
  }

  // equals はパス単位の突き合わせで順序に依らない（走査順は挿入順）。hashCode も
  // 順序へ依存させないため、要素ごとのハッシュを加算で畳み込む（Map.hashCode と同じ考え方）。
  override hashCode(): number {
    let hash = 0;
    for (const [path, entry] of this.#entries) {
      hash = (hash + combinedHash([path.hashCode(), entry.value().hashCode()])) | 0;
    }
    return hash;
  }

  toArray(): readonly TraceStateEntry[] {
    return [...this.#entries.values()];
  }
}
