import { CheckFamily } from "./check-family.ts";

// 検査ファミリー台帳面のファーストクラスコレクション（宣言順を保持——
// checked targets の並び順は宣言順に filter が走る凍結挙動）。
export class CheckFamilies {
  readonly #values: readonly CheckFamily[];

  private constructor(values: readonly CheckFamily[]) {
    this.#values = values;
  }

  static of(values: readonly CheckFamily[]): CheckFamilies {
    return new CheckFamilies([...values]);
  }

  static reconstitute(raws: readonly string[]): CheckFamilies {
    return new CheckFamilies(raws.map((r) => CheckFamily.reconstitute(r)));
  }

  add(value: CheckFamily): CheckFamilies {
    return new CheckFamilies([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<CheckFamily> {
    yield* this.#values;
  }

  // 「checked = 全 family − failed − skipped」の導出は台帳向けの集合知識。
  checkedTargetsExcluding(failed: ReadonlySet<string>, skipped: ReadonlySet<string>): string[] {
    return this.#values.filter((f) => !failed.has(f.asString()) && !skipped.has(f.asString())).map((f) => f.asCheckTarget());
  }

  toArray(): readonly CheckFamily[] {
    return this.#values;
  }
}
