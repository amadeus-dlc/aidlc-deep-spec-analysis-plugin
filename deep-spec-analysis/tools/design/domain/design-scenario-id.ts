import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignScenarioIdError = { readonly kind: "empty-design-scenario-id"; readonly raw: string };

export class DesignScenarioId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignScenarioId, DesignScenarioIdError> {
    if (raw === "") return err({ kind: "empty-design-scenario-id", raw });
    return ok(new DesignScenarioId(raw));
  }

  static reconstitute(raw: string): DesignScenarioId {
    return new DesignScenarioId(raw);
  }

  equals(other: DesignScenarioId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
