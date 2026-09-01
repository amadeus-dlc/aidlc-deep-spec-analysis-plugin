import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type IrDeclTokenError = { readonly kind: "empty-ir-decl-token"; readonly raw: string };

// decl 束のエンティティ名（well-formedness の重複・座標文言が使う）。
export class IrEntityName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<IrEntityName, IrDeclTokenError> {
    if (raw === "") return err({ kind: "empty-ir-decl-token", raw });
    return ok(new IrEntityName(raw));
  }

  static reconstitute(raw: string): IrEntityName {
    return new IrEntityName(raw);
  }

  equals(other: IrEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
