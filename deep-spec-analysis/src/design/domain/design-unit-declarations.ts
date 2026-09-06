import { ErrorMessage, ErrorMessages, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignUnitDeclaration } from "./design-unit-declaration.ts";

export class DesignUnitDeclarations extends FirstClassCollectionBase<DesignUnitDeclaration, DesignUnitDeclarations> {
  readonly #values: readonly DesignUnitDeclaration[];

  private constructor(values: readonly DesignUnitDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-unit-declarations");
  }

  protected rebuild(values: readonly DesignUnitDeclaration[]): DesignUnitDeclarations {
    return new DesignUnitDeclarations(values);
  }

  static of(values: readonly DesignUnitDeclaration[]): DesignUnitDeclarations {
    return new DesignUnitDeclarations(values);
  }

  static parse(values: readonly DesignUnitDeclaration[]): Result<DesignUnitDeclarations, ParseError> {
    return parseConstruction(() => new DesignUnitDeclarations(values));
  }

  add(value: DesignUnitDeclaration): DesignUnitDeclarations {
    return new DesignUnitDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnitDeclaration> {
    yield* this.#values;
  }

  // ユニット横断の不変条件（ユニット名の一意性）と、各ユニット自身の整合性を
  // 宣言順に集める（裁定 6）。重複ユニットの文言はユニットの文言に先立つ（凍結）。
  diagnostics(): ErrorMessages {
    const errors: string[] = [];
    const unitNames = new Set<string>();
    for (const unit of this.#values) {
      const unitName = unit.unit().asString();
      if (unitNames.has(unitName)) errors.push(`duplicate unit "${unitName}"`);
      unitNames.add(unitName);
      for (const message of unit.diagnostics()) errors.push(message.asString());
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  toArray(): readonly DesignUnitDeclaration[] {
    return this.#values;
  }
}
