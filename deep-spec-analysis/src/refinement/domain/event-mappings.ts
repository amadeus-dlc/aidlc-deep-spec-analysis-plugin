import type { TriggerName } from "@deep-spec/kernel-domain";
import type { EventMapping } from "./event-mapping.ts";

// eventMap 宣言のファーストクラスコレクション。トリガ索引は旧
// new Map(...) の凍結挙動どおり重複トリガは最後の宣言が勝つ。
export class EventMappings {
  readonly #values: readonly EventMapping[];

  private constructor(values: readonly EventMapping[]) {
    this.#values = values;
  }

  static of(values: readonly EventMapping[]): EventMappings {
    return new EventMappings([...values]);
  }

  add(value: EventMapping): EventMappings {
    return new EventMappings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EventMapping> {
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
