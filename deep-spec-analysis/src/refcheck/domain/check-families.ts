import { TargetIdentifier, TargetIdentifiers } from "@deep-spec/kernel-domain";

import type { CheckFamily } from "./check-family.ts";

// 検査ファミリー面のファーストクラスコレクション（宣言順を保持）。レポートは
// これを開いた時点の checked とし、finding／skip が family を外していく。
export class CheckFamilies {
  readonly #values: readonly CheckFamily[];

  private constructor(values: readonly CheckFamily[]) {
    this.#values = Object.freeze([...values]);
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
