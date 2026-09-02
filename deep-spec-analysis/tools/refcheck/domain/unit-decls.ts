import type { UnitDecl } from "./unit-decl.ts";
import { UnitNames } from "./unit-names.ts";

// units エッジブロックの宣言面——CD-1 の照合と CD-3 の走査順を知識に持つ。
export class UnitDecls {
  readonly #values: readonly UnitDecl[];

  private constructor(values: readonly UnitDecl[]) {
    this.#values = values;
  }

  static of(values: readonly UnitDecl[]): UnitDecls {
    return new UnitDecls([...values]);
  }

  add(value: UnitDecl): UnitDecls {
    return new UnitDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitDecl> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((u) => u.name().asString() === value);
  }

  names(): UnitNames {
    return UnitNames.of(this.#values.map((u) => u.name()));
  }

  // CD-3 の走査順（unit 名の辞書順）はコレクション知識。
  sortedByName(): UnitDecls {
    return new UnitDecls([...this.#values].sort((a, b) => (a.name().asString() < b.name().asString() ? -1 : 1)));
  }

  toArray(): readonly UnitDecl[] {
    return this.#values;
  }
}
