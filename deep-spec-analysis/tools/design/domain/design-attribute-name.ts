import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignMachineTokenError = { readonly kind: "empty-machine-token"; readonly raw: string };

export class DesignAttributeName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignAttributeName, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignAttributeName(raw));
  }

  static reconstitute(raw: string): DesignAttributeName {
    return new DesignAttributeName(raw);
  }

  equals(other: DesignAttributeName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
