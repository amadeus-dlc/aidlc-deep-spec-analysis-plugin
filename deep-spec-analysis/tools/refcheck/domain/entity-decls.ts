import { EntityDecl } from "./entity-decl.ts";
import { type AppliesTo } from "./applies-to.ts";
import { type ReferenceTarget } from "./reference-target.ts";

// エンティティ宣言のコレクション。重複・所属・正規化名解決・ライフサイクル
// 対象の選定・あいまい照合という集合の知識を所有する。
export class EntityDecls {
  readonly #values: readonly EntityDecl[];
  readonly #names: Set<string>;

  private constructor(values: readonly EntityDecl[]) {
    this.#values = values;
    this.#names = new Set(values.map((e) => e.name().asString()));
  }

  static of(values: readonly EntityDecl[]): EntityDecls {
    return new EntityDecls([...values]);
  }

  add(value: EntityDecl): EntityDecls {
    return new EntityDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EntityDecl> {
    yield* this.#values;
  }

  duplicatesByName(): EntityDecl[] {
    const seen = new Set<string>();
    const dups: EntityDecl[] = [];
    for (const e of this.#values) {
      if (seen.has(e.name().asString())) dups.push(e);
      seen.add(e.name().asString());
    }
    return dups;
  }

  containsNamed(value: string): boolean {
    return this.#names.has(value);
  }

  byNormalizedName(normalized: string): EntityDecl | undefined {
    return this.#values.find((e) => e.name().normalized() === normalized);
  }

  lifecycleOnly(): EntityDecl[] {
    return this.#values.filter((e) => e.lifecycleAttr() !== null);
  }

  // FD-E6: Entity / Entity.attr 形はエンティティ名の厳密照合、自由文は
  // 小文字包含の緩い照合（凍結挙動）。
  resolvesReference(reference: ReferenceTarget): boolean {
    const token = reference.entityToken();
    if (token !== null) return this.#names.has(token);
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

  toArray(): readonly EntityDecl[] {
    return this.#values;
  }
}
