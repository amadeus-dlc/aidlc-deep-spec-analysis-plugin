import { ObligationId } from "./obligation-id.ts";

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
