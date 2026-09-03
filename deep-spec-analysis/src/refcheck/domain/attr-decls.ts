import { AttrDecl } from "./attr-decl.ts";
import { type AttributeName } from "./attribute-name.ts";

// 属性宣言のコレクション。重複検出・ライフサイクル属性の選定・名前解決という
// 集合の知識を所有する。
export class AttrDecls {
  readonly #values: readonly AttrDecl[];

  private constructor(values: readonly AttrDecl[]) {
    this.#values = values;
  }

  static of(values: readonly AttrDecl[]): AttrDecls {
    return new AttrDecls([...values]);
  }

  add(value: AttrDecl): AttrDecls {
    return new AttrDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttrDecl> {
    yield* this.#values;
  }

  // 2 回目以降に現れた属性宣言（宣言順——旧 seen-set 走査と同じ列）。
  duplicatesByName(): AttrDecl[] {
    const seen = new Set<string>();
    const dups: AttrDecl[] = [];
    for (const a of this.#values) {
      if (seen.has(a.name().asString())) dups.push(a);
      seen.add(a.name().asString());
    }
    return dups;
  }

  // ライフサイクル属性：status/state の名で allowed を持つもの、無ければ
  // allowed を持つ唯一の属性、それも無ければ null（旧 lifecycleAttrOf）。
  lifecycleAttr(): AttrDecl | null {
    const named = this.#values.find((a) => a.bearsLifecycleName() && a.hasAllowedValues());
    if (named) return named;
    const withAllowed = this.#values.filter((a) => a.hasAllowedValues());
    return withAllowed.length === 1 ? (withAllowed[0] ?? null) : null;
  }

  named(token: string): AttrDecl | null {
    return this.#values.find((a) => a.name().asString() === token) ?? null;
  }

  names(): AttributeName[] {
    return this.#values.map((a) => a.name());
  }

  toArray(): readonly AttrDecl[] {
    return this.#values;
  }
}
