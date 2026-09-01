import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignMachineTokenError = { readonly kind: "empty-machine-token"; readonly raw: string };

export class DesignMachineId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignMachineId, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignMachineId(raw));
  }

  static reconstitute(raw: string): DesignMachineId {
    return new DesignMachineId(raw);
  }

  equals(other: DesignMachineId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
