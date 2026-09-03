import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type LocationError = { readonly kind: "non-positive-location"; readonly raw: number };

export class BlockIndex {
  readonly #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  static parse(raw: number): Result<BlockIndex, LocationError> {
    if (!Number.isInteger(raw) || raw < 1) return err({ kind: "non-positive-location", raw });
    return ok(new BlockIndex(raw));
  }

  static reconstitute(raw: number): BlockIndex {
    return new BlockIndex(raw);
  }

  equals(other: BlockIndex): boolean {
    return this.#value === other.#value;
  }

  asNumber(): number {
    return this.#value;
  }
}
