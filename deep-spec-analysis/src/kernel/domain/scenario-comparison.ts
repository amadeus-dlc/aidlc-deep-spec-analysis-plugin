import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { BackendName } from "./backend-name.ts";
import type { ScenarioVerdict } from "./scenario-verdict.ts";
import type { TargetIdentifier } from "./target-identifier.ts";
import type { UnitName } from "./unit-name.ts";

// 異なる二バックエンドによる、比較可能なシナリオ判定の組。
export class ScenarioComparison {
  readonly #first: ScenarioVerdict;
  readonly #second: ScenarioVerdict;

  private constructor(first: ScenarioVerdict, second: ScenarioVerdict) {
    if (!first.sameSubjectAs(second)) throw new IllegalArgumentException({ kind: "different-comparison-subjects" });
    if (!first.isComparable() || !second.isComparable())
      throw new IllegalArgumentException({ kind: "uncomparable-scenario-verdict" });
    if (first.backend().equals(second.backend()))
      throw new IllegalArgumentException({ kind: "same-comparison-backend" });
    this.#first = first;
    this.#second = second;
  }
  static of(first: ScenarioVerdict, second: ScenarioVerdict): ScenarioComparison {
    return new ScenarioComparison(first, second);
  }
  static parse(first: ScenarioVerdict, second: ScenarioVerdict): Result<ScenarioComparison, ParseError> {
    return parseConstruction(() => new ScenarioComparison(first, second));
  }
  isFor(target: TargetIdentifier, unit: UnitName | null): boolean {
    return this.#first.isFor(target, unit);
  }
  disagrees(): boolean {
    return !this.#first.agreesWith(this.#second);
  }
  backends(): readonly BackendName[] {
    return [this.#first.backend(), this.#second.backend()];
  }
  description(): string {
    return `Backends "${this.#first.backend().asString()}" and "${this.#second.backend().asString()}"`;
  }
  // witnessへ記録する二バックエンドの判定表。
  toVerdictTable(): { [backend: string]: "violated" | "clean" } {
    return Object.fromEntries([
      [this.#first.backend().asString(), this.#first.verdictLabel()],
      [this.#second.backend().asString(), this.#second.verdictLabel()],
    ]);
  }
}
