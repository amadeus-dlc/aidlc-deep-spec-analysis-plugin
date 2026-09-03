import type { DesignUnitDecl } from "./design-unit-decl.ts";

export class DesignUnitDecls {
  readonly #values: readonly DesignUnitDecl[];

  private constructor(values: readonly DesignUnitDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignUnitDecl[]): DesignUnitDecls {
    return new DesignUnitDecls([...values]);
  }

  add(value: DesignUnitDecl): DesignUnitDecls {
    return new DesignUnitDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnitDecl> {
    yield* this.#values;
  }

  // ユニット横断の不変条件（ユニット名の一意性）と、各ユニット自身の整合性を
  // 宣言順に集める（裁定 6）。重複ユニットの文言はユニットの文言に先立つ（凍結）。
  wellFormednessErrors(): string[] {
    const errors: string[] = [];
    const unitNames = new Set<string>();
    for (const unit of this.#values) {
      const unitName = unit.unit().asString();
      if (unitNames.has(unitName)) errors.push(`duplicate unit "${unitName}"`);
      unitNames.add(unitName);
      errors.push(...unit.wellFormednessErrors());
    }
    return errors;
  }

  toArray(): readonly DesignUnitDecl[] {
    return this.#values;
  }
}
