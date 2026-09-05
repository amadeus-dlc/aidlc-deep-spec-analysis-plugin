import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignScenarioId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-design-scenario-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignScenarioId {
    return new DesignScenarioId(raw);
  }

  static parse(raw: string): Result<DesignScenarioId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignScenarioId(raw));
  }

  equals(other: DesignScenarioId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignScenarioId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
