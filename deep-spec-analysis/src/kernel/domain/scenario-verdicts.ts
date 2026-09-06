import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { KeySet } from "./key-set.ts";
import { ScenarioComparison } from "./scenario-comparison.ts";
import type { ScenarioVerdict } from "./scenario-verdict.ts";

// 同じシナリオに対するバックエンドごとの判定。元のバックエンド順で比較する。
export class ScenarioVerdicts {
  readonly #values: readonly ScenarioVerdict[];

  /** 比較入力の予算は128バックエンド（最大8,128組）。コピーと一意性検査より先に確認する。 */
  private constructor(values: readonly ScenarioVerdict[]) {
    if (values.length > 128)
      throw new IllegalArgumentException({ kind: "too-many-scenario-verdicts", raw: values.length });
    const snapshot: ScenarioVerdict[] = [];
    for (const value of values) {
      if (snapshot.length === 128)
        throw new IllegalArgumentException({ kind: "too-many-scenario-verdicts", raw: snapshot.length + 1 });
      snapshot.push(value);
    }
    const comparable = snapshot.filter((value) => value.isComparable());
    if (comparable.some((value) => !value.sameSubjectAs(comparable[0])))
      throw new IllegalArgumentException({ kind: "different-scenario-subjects" });
    if (KeySet.of(comparable.map((value) => value.backend())).size() !== comparable.length)
      throw new IllegalArgumentException({ kind: "duplicate-scenario-backend" });
    this.#values = [...comparable];
  }
  static of(values: readonly ScenarioVerdict[]): ScenarioVerdicts {
    return new ScenarioVerdicts(values);
  }
  static parse(values: readonly ScenarioVerdict[]): Result<ScenarioVerdicts, ParseError> {
    return parseConstruction(() => new ScenarioVerdicts(values));
  }
  *comparisons(): IterableIterator<ScenarioComparison> {
    for (let i = 0; i < this.#values.length; i++)
      for (let j = i + 1; j < this.#values.length; j++) {
        const comparison = ScenarioComparison.parse(this.#values[i], this.#values[j]);
        if (!comparison.ok)
          throw new Error(`defect: validated scenario verdicts cannot be compared (${comparison.error.kind})`);
        yield comparison.value;
      }
  }
}
