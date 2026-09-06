import {
  boundedCollectionSnapshot,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";
import { KeySet } from "./key-set.ts";
import { ScenarioComparison } from "./scenario-comparison.ts";
import type { ScenarioVerdict } from "./scenario-verdict.ts";

// 同じシナリオに対するバックエンドごとの判定。元のバックエンド順で比較する。
export class ScenarioVerdicts extends FirstClassCollectionBase<ScenarioVerdict, ScenarioVerdicts> {
  readonly #values: readonly ScenarioVerdict[];

  /** 比較入力の予算は128バックエンド（最大8,128組）。コピーと一意性検査より先に確認する。 */
  private constructor(values: readonly ScenarioVerdict[]) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 128, "too-many-scenario-verdicts");
    const comparable = snapshot.filter((value) => value.isComparable());
    if (comparable.some((value) => !value.sameSubjectAs(comparable[0])))
      throw new IllegalArgumentException({ kind: "different-scenario-subjects" });
    if (KeySet.of(comparable.map((value) => value.backend())).size() !== comparable.length)
      throw new IllegalArgumentException({ kind: "duplicate-scenario-backend" });
    this.#values = [...comparable];
  }

  protected rebuild(values: readonly ScenarioVerdict[]): ScenarioVerdicts {
    return new ScenarioVerdicts(values);
  }

  *[Symbol.iterator](): Iterator<ScenarioVerdict> {
    yield* this.#values;
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
