// 設計義務（rules 起源の BR 参照つき）。逐語移動。id・nature・origin は
// ドメインプリミティブで運ぶ（既知集合は述語、未知は素通しの凍結挙動）。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type DesignObligationIdError = { readonly kind: "empty-design-obligation-id"; readonly raw: string };

export class DesignObligationId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignObligationId, DesignObligationIdError> {
    if (raw === "") return err({ kind: "empty-design-obligation-id", raw });
    return ok(new DesignObligationId(raw));
  }

  static reconstitute(raw: string): DesignObligationId {
    return new DesignObligationId(raw);
  }

  equals(other: DesignObligationId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

export class DesignObligationNature {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): DesignObligationNature {
    return new DesignObligationNature(raw);
  }

  equals(other: DesignObligationNature): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isEvent(): boolean {
    return this.#value === "event";
  }

  isInvariant(): boolean {
    return this.#value === "invariant";
  }

  isNumeric(): boolean {
    return this.#value === "numeric";
  }

  isStateTemporal(): boolean {
    return this.#value === "state-temporal";
  }
}

// 義務の起源（"" は未宣言・"rules" は BR 由来——decl 側の要求検査が使う語彙と
// 同じ閉集合。未知値は素通し）。
export class DesignObligationOrigin {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): DesignObligationOrigin {
    return new DesignObligationOrigin(raw);
  }

  equals(other: DesignObligationOrigin): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isRules(): boolean {
    return this.#value === "rules";
  }
}

import type { Expression, FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import { IdOrder } from "../../kernel/domain/index.ts";
import type { BrRefs } from "./design-ir-decl.ts";

export interface DesignObligation {
  id: DesignObligationId;
  nature: DesignObligationNature;
  origin: DesignObligationOrigin;
  brRefs: BrRefs;
  frRefs: FrRefs;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}

// 設計義務のファーストクラスコレクション。id 列の導出を所有する。
export class DesignObligations {
  readonly #values: readonly DesignObligation[];

  private constructor(values: readonly DesignObligation[]) {
    this.#values = values;
  }

  static of(values: readonly DesignObligation[]): DesignObligations {
    return new DesignObligations([...values]);
  }

  add(value: DesignObligation): DesignObligations {
    return new DesignObligations([...this.#values, value]);
  }

  // lowering の凍結順：IdOrder 正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignObligations {
    return new DesignObligations([...this.#values].sort((a, b) => IdOrder.compare(a.id.asString(), b.id.asString())));
  }

  *[Symbol.iterator](): Iterator<DesignObligation> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id.asString());
  }

  toArray(): readonly DesignObligation[] {
    return this.#values;
  }
}
