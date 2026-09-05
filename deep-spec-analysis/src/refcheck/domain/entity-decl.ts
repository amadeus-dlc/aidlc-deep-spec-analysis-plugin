import { AttrDecl } from "./attr-decl.ts";
import { AttrDecls } from "./attr-decls.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";
import { RelDecls } from "./rel-decls.ts";

// エンティティ宣言。属性の重複・選定・解決は属性コレクションに委ねる。
export class EntityDecl {
  readonly #name: EntityName;
  readonly #element: ElementPath;
  readonly #attrs: AttrDecls;
  readonly #rels: RelDecls;

  private constructor(seed: Parameters<typeof EntityDecl.of>[0]) {
    this.#name = seed.name;
    this.#element = seed.element;
    this.#attrs = seed.attrs;
    this.#rels = seed.rels;
  }

  static of(seed: {
    readonly name: EntityName;
    readonly element: ElementPath;
    readonly attrs: AttrDecls;
    readonly rels: RelDecls;
  }): EntityDecl {
    return new EntityDecl(seed);
  }

  name(): EntityName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  attrs(): AttrDecls {
    return this.#attrs;
  }

  rels(): RelDecls {
    return this.#rels;
  }

  lifecycleAttr(): AttrDecl | null {
    return this.#attrs.lifecycleAttr();
  }

  attrNamed(token: string): AttrDecl | null {
    return this.#attrs.named(token);
  }
}
