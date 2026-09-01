import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type IrDeclTokenError = { readonly kind: "empty-ir-decl-token"; readonly raw: string };

export class IrAttributeName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<IrAttributeName, IrDeclTokenError> {
    if (raw === "") return err({ kind: "empty-ir-decl-token", raw });
    return ok(new IrAttributeName(raw));
  }

  static reconstitute(raw: string): IrAttributeName {
    return new IrAttributeName(raw);
  }

  equals(other: IrAttributeName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
