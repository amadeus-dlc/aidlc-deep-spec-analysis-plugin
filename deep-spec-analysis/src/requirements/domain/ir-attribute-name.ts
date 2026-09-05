import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class IrAttributeName {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-ir-decl-token", raw });
    this.#value = raw;
  }

  static of(raw: string): IrAttributeName {
    return new IrAttributeName(raw);
  }

  static parse(raw: string): Result<IrAttributeName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new IrAttributeName(raw));
  }

  equals(other: IrAttributeName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
