import type { SmtEventPairProbe } from "./smt-event-pair-probe.ts";

// 同トリガ event 対プローブのファーストクラスコレクション（発行順を保持）。
export class SmtEventPairProbes {
  readonly #values: readonly SmtEventPairProbe[];

  private constructor(values: readonly SmtEventPairProbe[]) {
    this.#values = values;
  }

  static of(values: readonly SmtEventPairProbe[]): SmtEventPairProbes {
    return new SmtEventPairProbes([...values]);
  }

  add(value: SmtEventPairProbe): SmtEventPairProbes {
    return new SmtEventPairProbes([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SmtEventPairProbe> {
    yield* this.#values;
  }

  toArray(): readonly SmtEventPairProbe[] {
    return this.#values;
  }
}
