// 義務（EARS nature 付き）。逐語移動。id と nature はドメインプリミティブで
// 運ぶ（nature の既知集合は述語として所有——未知 nature は素通しで capability
// 文言に逐語で載る凍結挙動）。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type ObligationIdError = { readonly kind: "empty-obligation-id"; readonly raw: string };

export class ObligationId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ObligationId, ObligationIdError> {
    if (raw === "") return err({ kind: "empty-obligation-id", raw });
    return ok(new ObligationId(raw));
  }

  static reconstitute(raw: string): ObligationId {
    return new ObligationId(raw);
  }

  equals(other: ObligationId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

export class ObligationNature {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): ObligationNature {
    return new ObligationNature(raw);
  }

  equals(other: ObligationNature): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isInvariant(): boolean {
    return this.#value === "invariant";
  }

  isNumeric(): boolean {
    return this.#value === "numeric";
  }

  isEvent(): boolean {
    return this.#value === "event";
  }

  isStateTemporal(): boolean {
    return this.#value === "state-temporal";
  }
}

import type { Expression } from "../../kernel/domain/expression.ts";
import type { FrRefs, TriggerName } from "../../kernel/domain/index.ts";

export interface Obligation {
  id: ObligationId;
  nature: ObligationNature;
  frRefs: FrRefs;
  ears?: string;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}

// 義務のファーストクラスコレクション。id 検索と id 列の導出を所有する。
// 義務 id のファーストクラスコレクション(facts のイベント義務面など、
// 部分集合の id 列を運ぶ)。宣言順を保持し、toStrings() は境界(照会 API・
// TargetIds/frRefsOf の生 id 材料)専用の脱出口。
export class ObligationIds {
  readonly #values: readonly ObligationId[];

  private constructor(values: readonly ObligationId[]) {
    this.#values = values;
  }

  static of(values: readonly ObligationId[]): ObligationIds {
    return new ObligationIds([...values]);
  }

  add(value: ObligationId): ObligationIds {
    return new ObligationIds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ObligationId> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toStrings(): string[] {
    return this.#values.map((v) => v.asString());
  }
}

export class Obligations {
  readonly #values: readonly Obligation[];

  private constructor(values: readonly Obligation[]) {
    this.#values = values;
  }

  static of(values: readonly Obligation[]): Obligations {
    return new Obligations([...values]);
  }

  add(value: Obligation): Obligations {
    return new Obligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Obligation> {
    yield* this.#values;
  }

  byId(id: string): Obligation | undefined {
    return this.#values.find((o) => o.id.asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id.asString());
  }

  toArray(): readonly Obligation[] {
    return this.#values;
  }
}
