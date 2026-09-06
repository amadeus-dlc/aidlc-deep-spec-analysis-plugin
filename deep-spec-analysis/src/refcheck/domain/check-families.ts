import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

import type { CheckFamily } from "./check-family.ts";

// 検査ファミリー面のファーストクラスコレクション（宣言順を保持）。レポートは
// これを開いた時点の checked とし、finding／skip が family を外していく。
export class CheckFamilies
  extends FirstClassCollectionBase<CheckFamily, CheckFamilies>
  implements FirstClassCollection<CheckFamily>
{
  readonly #values: readonly CheckFamily[];

  private constructor(values: readonly CheckFamily[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-check-families");
  }

  protected rebuild(values: readonly CheckFamily[]): CheckFamilies {
    return new CheckFamilies(values);
  }

  static parse(values: readonly CheckFamily[]): Result<CheckFamilies, ParseError> {
    return parseConstruction(() => new CheckFamilies(values));
  }

  static of(values: readonly CheckFamily[]): CheckFamilies {
    return new CheckFamilies(values);
  }

  add(value: CheckFamily): CheckFamilies {
    return new CheckFamilies([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<CheckFamily> {
    yield* this.#values;
  }

  // 全 family の check target（`check:${family}`）——レポートを開いた時点の
  // checked の材料。
  checkTargets(): TargetIdentifiers {
    return TargetIdentifiers.of(
      Array.from(
        this.#values.map((f) => f.asCheckTarget()),
        (raw) => TargetIdentifier.of(raw),
      ),
    );
  }

  toArray(): readonly CheckFamily[] {
    return this.#values;
  }
}
