import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class BlockIndex {
  readonly #value: number;

  private constructor(raw: number) {
    if (!Number.isSafeInteger(raw) || raw < 1)
      throw new IllegalArgumentException({ kind: "non-positive-location", raw });
    this.#value = raw;
  }

  static of(raw: number): BlockIndex {
    return new BlockIndex(raw);
  }

  static parse(raw: number): Result<BlockIndex, ParseError> {
    return parseConstruction(() => new BlockIndex(raw));
  }

  equals(other: BlockIndex): boolean {
    return this.#value === other.#value;
  }

  asNumber(): number {
    return this.#value;
  }
}
