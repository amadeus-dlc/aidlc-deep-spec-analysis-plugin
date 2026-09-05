import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { TargetId } from "@deep-spec/kernel-domain";

export class ScenarioId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-scenario-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ScenarioId {
    return new ScenarioId(raw);
  }

  static parse(raw: string): Result<ScenarioId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new ScenarioId(raw));
  }

  equals(other: ScenarioId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  // シナリオ id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetId {
    return TargetId.of(this.#value);
  }
}
