import type { DeclaredBindingValue } from "@deep-spec/kernel-domain";
import { type DeclaredBound, AttributeKind } from "@deep-spec/kernel-domain";
import { type IrAttributeName } from "./ir-attribute-name.ts";
import type { IrDeclaredValues } from "./ir-declared-values.ts";

// 属性宣言。型宣言が欠けた属性は kind: "" として届く（旧実装は type 欠落でも
// 属性をカタログへ登録した——参照解決の可否がそれで変わるため保存する）。
// 主従の裁定（2026-09-01、#71 波1）: 宣言は命令できる抽象データ型——
// well-formedness の判事が吸い出していた判断を宣言自身が所有する。
export class IrAttributeDecl {
  readonly #name: IrAttributeName;
  readonly #kind: AttributeKind;
  readonly #values: IrDeclaredValues | undefined;
  readonly #min: DeclaredBound | undefined;
  readonly #max: DeclaredBound | undefined;

  // ドアの引数は無名のインライン署名で運ぶ——名前付き getter-only 型
  //（データモデル）を domain 層に住まわせない（主従の裁定・補遺）。
  private constructor(props: Parameters<typeof IrAttributeDecl.of>[0]) {
    this.#name = props.name;
    this.#kind = props.kind;
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }

  static of(props: { name: IrAttributeName; kind: AttributeKind; values?: IrDeclaredValues; min?: DeclaredBound; max?: DeclaredBound }): IrAttributeDecl {
    return new IrAttributeDecl(props);
  }

  // 同定面（座標組み立て・重複検査の材料）。
  name(): IrAttributeName {
    return this.#name;
  }

  boundsInverted(): boolean {
    return this.#kind.isInt() && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }

  boundsOutsideSafeRange(): boolean {
    return (
      (this.#min !== undefined && !this.#min.isSafeInteger()) ||
      (this.#max !== undefined && !this.#max.isSafeInteger())
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
