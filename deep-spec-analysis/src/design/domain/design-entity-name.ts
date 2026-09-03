import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type DesignMachineTokenError = { readonly kind: "empty-machine-token"; readonly raw: string };

export class DesignEntityName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignEntityName, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignEntityName(raw));
  }

  static reconstitute(raw: string): DesignEntityName {
    return new DesignEntityName(raw);
  }

  equals(other: DesignEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
