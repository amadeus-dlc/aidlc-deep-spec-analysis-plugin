import type { UnitName } from "@deep-spec-analysis/kernel-domain";
import { combinedHash } from "@deep-spec-analysis/kernel-infrastructure";
import type { EntityDeclarations } from "./entity-declarations.ts";

// ユニット索引の論理項目。unit を値から切り離すと同名 EntityDeclaration を別
// unit のものと混同するため、所有 unit とその宣言集合を同じ要素として運ぶ。
export class SiblingUnitIndexEntry {
  readonly #unit: UnitName;
  readonly #declarations: EntityDeclarations;

  private constructor(unit: UnitName, declarations: EntityDeclarations) {
    this.#unit = unit;
    this.#declarations = declarations;
  }

  static of(unit: UnitName, declarations: EntityDeclarations): SiblingUnitIndexEntry {
    return new SiblingUnitIndexEntry(unit, declarations);
  }

  unit(): UnitName {
    return this.#unit;
  }

  declarations(): EntityDeclarations {
    return this.#declarations;
  }

  equals(other: SiblingUnitIndexEntry): boolean {
    return this.#unit.equals(other.#unit) && this.#declarations.equals(other.#declarations);
  }

  hashCode(): number {
    return combinedHash([this.#unit.hashCode(), this.#declarations.hashCode()]);
  }
}
