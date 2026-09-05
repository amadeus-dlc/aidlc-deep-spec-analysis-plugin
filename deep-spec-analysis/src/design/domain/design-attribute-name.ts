import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignAttributeName {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignAttributeName {
    return new DesignAttributeName(raw);
  }

  static parse(raw: string): Result<DesignAttributeName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignAttributeName(raw));
  }

  equals(other: DesignAttributeName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
