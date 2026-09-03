import { type AttributeNames } from "./attribute-names.ts";
import { type EntityName } from "./entity-name.ts";

// 兄弟ユニットの entities.md 索引。ユニット横断の定義元探索と、ユニット内の
// 正規化名解決という集合の知識を所有する（XS 検査の凍結挙動）。
export class SiblingUnitIndex {
  readonly #units: ReadonlyMap<string, ReadonlyMap<string, { name: EntityName; attrs: AttributeNames }>>;

  private constructor(units: ReadonlyMap<string, ReadonlyMap<string, { name: EntityName; attrs: AttributeNames }>>) {
    this.#units = units;
  }

  static of(units: ReadonlyMap<string, ReadonlyMap<string, { name: EntityName; attrs: AttributeNames }>>): SiblingUnitIndex {
    return new SiblingUnitIndex(new Map(units));
  }

  // この正規化名のエンティティを定義しているユニット（登録順——凍結順）。
  definersOf(normalizedName: string): string[] {
    return [...this.#units.entries()].filter(([, m]) => m.has(normalizedName)).map(([u]) => u);
  }

  entityDeclaredIn(unit: string, normalizedName: string): { name: EntityName; attrs: AttributeNames } | undefined {
    return this.#units.get(unit)?.get(normalizedName);
  }

  hasAnyUnit(): boolean {
    return this.#units.size > 0;
  }
}
