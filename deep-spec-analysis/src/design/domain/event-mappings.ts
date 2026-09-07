import { FirstClassCollectionBase, type TriggerName } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { EventMapping } from "./event-mapping.ts";

// eventMap 宣言のファーストクラスコレクション。トリガ索引は旧
// new Map(...) の凍結挙動どおり重複トリガは最後の宣言が勝つ。
export class EventMappings extends FirstClassCollectionBase<EventMapping, EventMappings> {
  readonly #values: readonly EventMapping[];

  private constructor(values: readonly EventMapping[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-event-mappings");
  }

  protected override rebuild(values: readonly EventMapping[]): EventMappings {
    return new EventMappings(values);
  }

  static of(values: readonly EventMapping[]): EventMappings {
    return new EventMappings(values);
  }

  override map(transform: (element: EventMapping) => EventMapping): EventMappings {
    return this.mapTo(transform, EventMappings.of);
  }

  override combine(other: EventMappings): EventMappings {
    return this.combineTo(other, EventMappings.of);
  }

  static parse(values: readonly EventMapping[]): Result<EventMappings, ParseError> {
    return parseConstruction(() => new EventMappings(values));
  }

  add(value: EventMapping): EventMappings {
    return new EventMappings([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<EventMapping> {
    yield* this.#values;
  }

  ofTrigger(reqTrigger: TriggerName): EventMapping | undefined {
    let found: EventMapping | undefined;
    for (const e of this.#values) {
      if (e.isForTrigger(reqTrigger)) found = e;
    }
    return found;
  }

  toArray(): readonly EventMapping[] {
    return this.#values;
  }
}
