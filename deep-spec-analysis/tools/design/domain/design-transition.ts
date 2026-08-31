// 状態機械の遷移（契約3）。逐語移動。id はドメインプリミティブで運ぶ。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type DesignTransitionIdError = { readonly kind: "empty-design-transition-id"; readonly raw: string };

export class DesignTransitionId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignTransitionId, DesignTransitionIdError> {
    if (raw === "") return err({ kind: "empty-design-transition-id", raw });
    return ok(new DesignTransitionId(raw));
  }

  static reconstitute(raw: string): DesignTransitionId {
    return new DesignTransitionId(raw);
  }

  equals(other: DesignTransitionId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

import { IdOrder } from "../../kernel/domain/index.ts";
import type { Expression, TriggerName } from "../../kernel/domain/index.ts";
import type { BrRefs } from "./design-ir-decl.ts";

export interface DesignTransition {
  id: DesignTransitionId;
  from: string;
  to: string;
  trigger: TriggerName;
  guard?: Expression;
  effect?: Expression;
  brRefs: BrRefs;
}

// 遷移のファーストクラスコレクション。id の正準順（lowering の凍結順）を所有。
export class DesignTransitions {
  readonly #values: readonly DesignTransition[];

  private constructor(values: readonly DesignTransition[]) {
    this.#values = values;
  }

  static of(values: readonly DesignTransition[]): DesignTransitions {
    return new DesignTransitions([...values]);
  }

  add(value: DesignTransition): DesignTransitions {
    return new DesignTransitions([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransition> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((t) => t.id.asString());
  }

  sortedCanonically(): DesignTransitions {
    return new DesignTransitions([...this.#values].sort((a, b) => IdOrder.compare(a.id.asString(), b.id.asString())));
  }

  toArray(): readonly DesignTransition[] {
    return this.#values;
  }
}
