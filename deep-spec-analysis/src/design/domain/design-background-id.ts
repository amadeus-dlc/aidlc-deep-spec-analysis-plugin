import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignBackgroundId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-design-background-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignBackgroundId {
    return new DesignBackgroundId(raw);
  }

  static parse(raw: string): Result<DesignBackgroundId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignBackgroundId(raw));
  }

  equals(other: DesignBackgroundId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignBackgroundId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
