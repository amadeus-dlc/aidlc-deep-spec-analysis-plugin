import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// decl 束のエンティティ名（well-formedness の重複・座標文言が使う）。
export class IrEntityName {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-ir-decl-token", raw });
    this.#value = raw;
  }

  static of(raw: string): IrEntityName {
    return new IrEntityName(raw);
  }

  static parse(raw: string): Result<IrEntityName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new IrEntityName(raw));
  }

  equals(other: IrEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
