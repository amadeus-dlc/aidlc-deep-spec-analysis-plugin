import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignObligationDeclaration } from "./design-obligation-declaration.ts";

export class DesignObligationDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<DesignObligationDeclaration>
{
  readonly #values: readonly DesignObligationDeclaration[];

  private constructor(values: readonly DesignObligationDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignObligationDeclaration[]): DesignObligationDeclarations {
    return new DesignObligationDeclarations(values);
  }

  add(value: DesignObligationDeclaration): DesignObligationDeclarations {
    return new DesignObligationDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignObligationDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignObligationDeclaration[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
