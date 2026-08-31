// 設計シナリオ（受け入れ／拒否、BR/FR 両参照つき）。逐語移動。id は
// ドメインプリミティブで運ぶ。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type DesignScenarioIdError = { readonly kind: "empty-design-scenario-id"; readonly raw: string };

export class DesignScenarioId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignScenarioId, DesignScenarioIdError> {
    if (raw === "") return err({ kind: "empty-design-scenario-id", raw });
    return ok(new DesignScenarioId(raw));
  }

  static reconstitute(raw: string): DesignScenarioId {
    return new DesignScenarioId(raw);
  }

  equals(other: DesignScenarioId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

import type { Expression, FrRefs } from "../../kernel/domain/index.ts";
import { IdOrder } from "../../kernel/domain/index.ts";
import type { BrRefs } from "./design-ir-decl.ts";

export interface DesignScenario {
  id: DesignScenarioId;
  kind: "accept" | "reject";
  brRefs: BrRefs;
  frRefs: FrRefs;
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}

// 設計シナリオのファーストクラスコレクション。
export class DesignScenarios {
  readonly #values: readonly DesignScenario[];

  private constructor(values: readonly DesignScenario[]) {
    this.#values = values;
  }

  static of(values: readonly DesignScenario[]): DesignScenarios {
    return new DesignScenarios([...values]);
  }

  add(value: DesignScenario): DesignScenarios {
    return new DesignScenarios([...this.#values, value]);
  }

  // lowering の凍結順：IdOrder 正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignScenarios {
    return new DesignScenarios([...this.#values].sort((a, b) => IdOrder.compare(a.id.asString(), b.id.asString())));
  }

  *[Symbol.iterator](): Iterator<DesignScenario> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id.asString());
  }

  toArray(): readonly DesignScenario[] {
    return this.#values;
  }
}
