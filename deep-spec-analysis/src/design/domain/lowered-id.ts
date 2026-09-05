import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// lowered 採番 id(OB-n / SC-n / BG-n)——v1 子文書のバイト面に載る識別。
export class LoweredId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-lowered-token", raw });
    this.#value = raw;
  }

  static of(raw: string): LoweredId {
    return new LoweredId(raw);
  }

  static parse(raw: string): Result<LoweredId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new LoweredId(raw));
  }

  equals(other: LoweredId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
