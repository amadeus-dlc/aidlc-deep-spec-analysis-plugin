import type { AttributeKind, DeclaredBindingValue, DeclaredBound, EnumerationMembers } from "@deep-spec/kernel-domain";
import type { IntermediateRepresentationAttributeName } from "./intermediate-representation-attribute-name.ts";

// 属性宣言。型宣言が欠けた属性は kind: "" として届く（旧実装は type 欠落でも
// 属性をカタログへ登録した——参照解決の可否がそれで変わるため保存する）。
// 主従の裁定（2026-09-01、#71 波1）: 宣言は命令できる抽象データ型——
// well-formedness の判事が吸い出していた判断を宣言自身が所有する。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationAttributeDeclarationParam = {
  name: IntermediateRepresentationAttributeName;
  kind: AttributeKind;
  values?: EnumerationMembers;
  min?: DeclaredBound;
  max?: DeclaredBound;
};

export class IntermediateRepresentationAttributeDeclaration {
  readonly #name: IntermediateRepresentationAttributeName;
  readonly #kind: AttributeKind;
  readonly #values: EnumerationMembers | undefined;
  readonly #min: DeclaredBound | undefined;
  readonly #max: DeclaredBound | undefined;

  // 未検証の構築引数はParam型として明示し、ドメインオブジェクトと区別する。
  private constructor(props: IntermediateRepresentationAttributeDeclarationParam) {
    this.#name = props.name;
    this.#kind = props.kind;
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }

  static of(
    props: IntermediateRepresentationAttributeDeclarationParam,
  ): IntermediateRepresentationAttributeDeclaration {
    return new IntermediateRepresentationAttributeDeclaration(props);
  }

  // 同定面（座標組み立て・重複検査の材料）。
  name(): IntermediateRepresentationAttributeName {
    return this.#name;
  }

  boundsInverted(): boolean {
    return this.#kind.isInt() && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }

  boundsOutsideSafeRange(): boolean {
    return (
      (this.#min !== undefined && !this.#min.isSafeInteger()) || (this.#max !== undefined && !this.#max.isSafeInteger())
    );
  }

  admitsEnumLiteral(value: string): boolean {
    return this.#kind.isEnum() && (this.#values?.includes(value) ?? false);
  }

  // scenario binding の適合（bool / 安全整数 int / 宣言済み enum 値）。
  fitsBinding(value: DeclaredBindingValue): boolean {
    return value.fits(this.#kind, (literal) => this.admitsEnumLiteral(literal));
  }

  // 文言材料（binding 不適合文言の "${kind} attribute" 描画点）。
  kindLabel(): string {
    return this.#kind.asString();
  }
}
