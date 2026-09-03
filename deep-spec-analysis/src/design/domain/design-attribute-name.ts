import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

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
