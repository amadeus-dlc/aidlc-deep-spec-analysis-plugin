import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignEntityName {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignEntityName {
    return new DesignEntityName(raw);
  }

  static parse(raw: string): Result<DesignEntityName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignEntityName(raw));
  }

  equals(other: DesignEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
