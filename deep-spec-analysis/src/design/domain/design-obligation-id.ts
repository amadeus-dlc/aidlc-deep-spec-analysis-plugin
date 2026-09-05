import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignObligationId {
  readonly #value: string;

  private constructor(raw: string) {
    if (!/^DOB-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-design-obligation-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignObligationId {
    return new DesignObligationId(raw);
  }

  static parse(raw: string): Result<DesignObligationId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignObligationId(raw));
  }

  equals(other: DesignObligationId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignObligationId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
