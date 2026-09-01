import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type LoweredTokenError = { readonly kind: "empty-lowered-token"; readonly raw: string };

// lowered 帰属の設計側参照(DOB/TR/DSC/DBG id——remap の書き戻し語彙)。
export class LoweredOriginRef {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<LoweredOriginRef, LoweredTokenError> {
    if (raw === "") return err({ kind: "empty-lowered-token", raw });
    return ok(new LoweredOriginRef(raw));
  }

  static reconstitute(raw: string): LoweredOriginRef {
    return new LoweredOriginRef(raw);
  }

  equals(other: LoweredOriginRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
