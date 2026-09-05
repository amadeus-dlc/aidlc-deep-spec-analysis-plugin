import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignTransitionId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-design-transition-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignTransitionId {
    return new DesignTransitionId(raw);
  }

  static parse(raw: string): Result<DesignTransitionId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignTransitionId(raw));
  }

  equals(other: DesignTransitionId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignTransitionId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
