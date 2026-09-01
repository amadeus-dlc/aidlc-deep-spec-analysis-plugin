import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignBackgroundIdError = { readonly kind: "empty-design-background-id"; readonly raw: string };

export class DesignBackgroundId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignBackgroundId, DesignBackgroundIdError> {
    if (raw === "") return err({ kind: "empty-design-background-id", raw });
    return ok(new DesignBackgroundId(raw));
  }

  static reconstitute(raw: string): DesignBackgroundId {
    return new DesignBackgroundId(raw);
  }

  equals(other: DesignBackgroundId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
