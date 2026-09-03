import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type LoweredTokenError = { readonly kind: "empty-lowered-token"; readonly raw: string };

// lowered 採番 id(OB-n / SC-n / BG-n)——v1 子文書のバイト面に載る識別。
export class LoweredId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<LoweredId, LoweredTokenError> {
    if (raw === "") return err({ kind: "empty-lowered-token", raw });
    return ok(new LoweredId(raw));
  }

  static reconstitute(raw: string): LoweredId {
    return new LoweredId(raw);
  }

  equals(other: LoweredId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
