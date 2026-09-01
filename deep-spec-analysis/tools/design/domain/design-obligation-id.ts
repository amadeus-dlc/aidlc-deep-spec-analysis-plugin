import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignObligationIdError = { readonly kind: "empty-design-obligation-id"; readonly raw: string };

export class DesignObligationId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignObligationId, DesignObligationIdError> {
    if (raw === "") return err({ kind: "empty-design-obligation-id", raw });
    return ok(new DesignObligationId(raw));
  }

  static reconstitute(raw: string): DesignObligationId {
    return new DesignObligationId(raw);
  }

  equals(other: DesignObligationId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
