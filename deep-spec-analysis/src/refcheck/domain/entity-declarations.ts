import type { NormalizedName } from "@deep-spec/kernel-domain";
import { KeySet } from "@deep-spec/kernel-domain";
import { EntityDeclaration } from "./entity-declaration.ts";
import { type AppliesTo } from "./applies-to.ts";
import { type ReferenceTarget } from "./reference-target.ts";

import { EntityName } from "./entity-name.ts";

// エンティティ宣言のコレクション。重複・所属・正規化名解決・ライフサイクル
// 対象の選定・あいまい照合という集合の知識を所有する。
export class EntityDeclarations {
  readonly #values: readonly EntityDeclaration[];
  readonly #names: KeySet<EntityName>;

  private constructor(values: readonly EntityDeclaration[]) {
    this.#values = Object.freeze([...values]);
    this.#names = KeySet.of(values.map((e) => e.name()));
  }

  static of(values: readonly EntityDeclaration[]): EntityDeclarations {
    return new EntityDeclarations(values);
  }

  add(value: EntityDeclaration): EntityDeclarations {
    return new EntityDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EntityDeclaration> {
    yield* this.#values;
  }

  duplicatesByName(): EntityDeclaration[] {
    const seen = new Set<string>();
    const dups: EntityDeclaration[] = [];
    for (const e of this.#values) {
      if (seen.has(e.name().asString())) dups.push(e);
      seen.add(e.name().asString());
    }
    return dups;
  }

  containsNamed(name: EntityName): boolean {
    return this.#names.has(name);
  }

  byNormalizedName(normalized: NormalizedName): EntityDeclaration | undefined {
    return this.#values.find((e) => e.name().normalized().equals(normalized));
  }

  lifecycleOnly(): EntityDeclaration[] {
    return this.#values.filter((e) => e.lifecycleAttr() !== null);
  }

  // FD-E6: Entity / Entity.attr 形はエンティティ名の厳密照合、自由文は
  // 小文字包含の緩い照合（凍結挙動）。
  resolvesReference(reference: ReferenceTarget): boolean {
    const token = reference.entityToken();
    if (token !== null) return this.#names.has(EntityName.of(token));
    return this.#values.some((d) => reference.looselyMentions(d.name()));
  }

  // FD-R4: applies-to が Entity / Entity.attribute へ解決するか。
  resolvesAppliesTo(target: AppliesTo): boolean {
    const token = target.entityToken();
    if (token !== null) {
      const ent = this.#values.find((e) => e.name().asString() === token);
      const attr = target.attributeToken();
      return ent !== undefined && (attr === null || ent.attrNamed(attr) !== null);
    }
    return this.#values.some((e) => target.looselyMentions(e.name()));
  }

  toArray(): readonly EntityDeclaration[] {
    return this.#values;
  }
}
