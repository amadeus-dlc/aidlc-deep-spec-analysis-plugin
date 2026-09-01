import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignTransitionIdError = { readonly kind: "empty-design-transition-id"; readonly raw: string };

export class DesignTransitionId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignTransitionId, DesignTransitionIdError> {
    if (raw === "") return err({ kind: "empty-design-transition-id", raw });
    return ok(new DesignTransitionId(raw));
  }

  static reconstitute(raw: string): DesignTransitionId {
    return new DesignTransitionId(raw);
  }

  equals(other: DesignTransitionId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
