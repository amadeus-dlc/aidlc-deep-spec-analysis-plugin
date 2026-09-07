import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import {
  hashOfNumber,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

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

  hashCode(): number {
    return hashOfNumber(this.#value);
  }

  asNumber(): number {
    return this.#value;
  }
}
