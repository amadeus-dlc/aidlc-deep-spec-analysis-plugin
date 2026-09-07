import {
  type AttributePath,
  type FirstClassCollection,
  FirstClassCollectionBase,
  KeyedIndex,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RequirementAttributeDeclaration } from "./requirement-attribute-declaration.ts";

// 属性宣言のファーストクラスコレクション。パス索引という集合の知識を所有し、
// ドメイン層に裸の配列・Map を流さない。toArray() は境界専用の脱出口。
export class RequirementAttributeDeclarations
  extends FirstClassCollectionBase<RequirementAttributeDeclaration, RequirementAttributeDeclarations>
  implements FirstClassCollection<RequirementAttributeDeclaration>
{
  readonly #values: readonly RequirementAttributeDeclaration[];
  readonly #byPath: KeyedIndex<AttributePath, RequirementAttributeDeclaration>;

  private constructor(values: readonly RequirementAttributeDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-requirement-attribute-declarations");
    this.#byPath = KeyedIndex.of(this.#values.map((a) => [a.path(), a] as const));
  }

  protected override rebuild(values: readonly RequirementAttributeDeclaration[]): RequirementAttributeDeclarations {
    return new RequirementAttributeDeclarations(values);
  }

  static parse(
    values: readonly RequirementAttributeDeclaration[],
  ): Result<RequirementAttributeDeclarations, ParseError> {
    return parseConstruction(() => new RequirementAttributeDeclarations(values));
  }

  static of(values: readonly RequirementAttributeDeclaration[]): RequirementAttributeDeclarations {
    return new RequirementAttributeDeclarations(values);
  }

  add(value: RequirementAttributeDeclaration): RequirementAttributeDeclarations {
    return new RequirementAttributeDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<RequirementAttributeDeclaration> {
    yield* this.#values;
  }

  byPath(path: AttributePath): RequirementAttributeDeclaration | undefined {
    return this.#byPath.get(path);
  }

  // 旧センサー逐語の path 辞書順（byte-frozen）。重複 path は ir-valid の
  // duplicate-attribute 検査が表面化し、等値時に 1 を返す挙動も凍結面
  // （return 0 への正規化は重複時の安定順を変え得るため PR10 の凍結台帳で扱う）。
  sortedByPath(): RequirementAttributeDeclarations {
    return new RequirementAttributeDeclarations(
      [...this.#values].sort((a, b) => (a.path().asString() < b.path().asString() ? -1 : 1)),
    );
  }

  toArray(): readonly RequirementAttributeDeclaration[] {
    return this.#values;
  }
}
