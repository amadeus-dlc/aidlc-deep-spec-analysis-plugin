// 受け入れ／拒否シナリオ。逐語移動。id はドメインプリミティブで運ぶ。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type ScenarioIdError = { readonly kind: "empty-scenario-id"; readonly raw: string };

export class ScenarioId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ScenarioId, ScenarioIdError> {
    if (raw === "") return err({ kind: "empty-scenario-id", raw });
    return ok(new ScenarioId(raw));
  }

  static reconstitute(raw: string): ScenarioId {
    return new ScenarioId(raw);
  }

  equals(other: ScenarioId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

import type { Expression } from "../../kernel/domain/expression.ts";
import type { FrRefs } from "../../kernel/domain/index.ts";

export interface Scenario {
  id: ScenarioId;
  kind: "accept" | "reject";
  frRefs: FrRefs;
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}

// シナリオのファーストクラスコレクション。id 検索と id 列の導出を所有する。
export class Scenarios {
  readonly #values: readonly Scenario[];

  private constructor(values: readonly Scenario[]) {
    this.#values = values;
  }

  static of(values: readonly Scenario[]): Scenarios {
    return new Scenarios([...values]);
  }

  add(value: Scenario): Scenarios {
    return new Scenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Scenario> {
    yield* this.#values;
  }

  byId(id: string): Scenario | undefined {
    return this.#values.find((s) => s.id.asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id.asString());
  }

  toArray(): readonly Scenario[] {
    return this.#values;
  }
}
