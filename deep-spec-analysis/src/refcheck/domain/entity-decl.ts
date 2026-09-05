import { AttrDecl } from "./attr-decl.ts";
import { AttrDecls } from "./attr-decls.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";
import { RelDecls } from "./rel-decls.ts";

// エンティティ宣言。属性の重複・選定・解決は属性コレクションに委ねる。
export class EntityDecl {
  readonly #seed: {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly attrs: AttrDecls;
  readonly rels: RelDecls;
  };

  private constructor(seed: Parameters<typeof EntityDecl.of>[0]) {
    this.#seed = seed;
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
    return this.#seed.name;
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  attrs(): AttrDecls {
    return this.#seed.attrs;
  }

  rels(): RelDecls {
    return this.#seed.rels;
  }

  lifecycleAttr(): AttrDecl | null {
    return this.#seed.attrs.lifecycleAttr();
  }

  attrNamed(token: string): AttrDecl | null {
    return this.#seed.attrs.named(token);
  }
}
