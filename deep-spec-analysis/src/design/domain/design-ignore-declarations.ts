import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignIgnoreDeclaration } from "./design-ignore-declaration.ts";

export class DesignIgnoreDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<DesignIgnoreDeclaration>
{
  readonly #values: readonly DesignIgnoreDeclaration[];

  private constructor(values: readonly DesignIgnoreDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignIgnoreDeclaration[]): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations(values);
  }

  add(value: DesignIgnoreDeclaration): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignIgnoreDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignIgnoreDeclaration[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
