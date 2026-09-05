import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// lowered 帰属の設計側参照(DOB/TR/DSC/DBG id——remap の書き戻し語彙)。
export class LoweredOriginRef {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-lowered-token", raw });
    this.#value = raw;
  }

  static of(raw: string): LoweredOriginRef {
    return new LoweredOriginRef(raw);
  }

  static parse(raw: string): Result<LoweredOriginRef, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new LoweredOriginRef(raw));
  }

  equals(other: LoweredOriginRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
