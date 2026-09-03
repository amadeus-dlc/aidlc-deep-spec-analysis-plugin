import { type AttributeBound, AttributeKind } from "@deep-spec/kernel-domain";
import type { DeclaredValues } from "./declared-values.ts";
import { type DesignAttributeName } from "./design-attribute-name.ts";

// 属性宣言（bool / 有界 int / enum）。型宣言が欠けた属性は kind: "" で届く
//（旧実装はカタログへ登録した——参照解決の可否が変わるため保存）。
// 主従の裁定（2026-09-01、#71 波1）: 宣言は命令できる抽象データ型——
// well-formedness の判事が吸い出していた判断（bounds 三態・binding 適合・
// enum リテラル所属・machine 状態面）を宣言自身が所有し、プロパティ読みは
// 構築ドア（I/O 文脈）だけに残る。文言と発生順は判事側の凍結面のまま。
export class DesignAttributeDecl {
  readonly #name: DesignAttributeName;
  readonly #kind: AttributeKind;
  // 執筆者向けの説明文（契約3 の任意項目——ツールは読まず、lowered 文書へ逐語で運ぶ）。
  readonly #description: string | undefined;
  readonly #values: DeclaredValues | undefined;
  readonly #min: AttributeBound | undefined;
  readonly #max: AttributeBound | undefined;

  // ドアの引数は無名のインライン署名で運ぶ——名前付き getter-only 型
  //（データモデル）を domain 層に住まわせない（主従の裁定・補遺）。
  private constructor(props: { name: DesignAttributeName; kind: string; description?: string; values?: DeclaredValues; min?: AttributeBound; max?: AttributeBound }) {
    this.#name = props.name;
    this.#kind = AttributeKind.reconstitute(props.kind);
    this.#description = props.description;
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }

  static reconstitute(props: { name: DesignAttributeName; kind: string; description?: string; values?: DeclaredValues; min?: AttributeBound; max?: AttributeBound }): DesignAttributeDecl {
    return new DesignAttributeDecl(props);
  }

  // 同定面（座標組み立て・重複検査の材料）。
  name(): DesignAttributeName {
    return this.#name;
  }

  // int 属性に必須の有界性（Quint backend の有限領域要件）を欠くか。
  lacksIntBounds(): boolean {
    return this.#kind.isInt() && (this.#min === undefined || this.#max === undefined);
  }

  boundsInverted(): boolean {
    return this.#kind.isInt() && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }

  boundsOutsideSafeRange(): boolean {
    return (
      (this.#min !== undefined && !Number.isSafeInteger(this.#min.asNumber())) ||
      (this.#max !== undefined && !Number.isSafeInteger(this.#max.asNumber()))
    );
  }

  isEnum(): boolean {
    return this.#kind.isEnum();
  }

  admitsEnumLiteral(value: string): boolean {
    return this.#kind.isEnum() && (this.#values?.includes(value) ?? false);
  }

  // scenario binding の適合（bool / 安全整数 int / 宣言済み enum 値）。
  fitsBinding(value: unknown): boolean {
    return (
      (this.#kind.isBool() && typeof value === "boolean") ||
      (this.#kind.isInt() && typeof value === "number" && Number.isSafeInteger(value)) ||
      (this.#kind.isEnum() && typeof value === "string" && (this.#values?.includes(value) ?? false))
    );
  }

  // machine の状態集合面——enum でなければ null（判事が凍結文言で報告する）。
  enumStates(): DeclaredValues | null {
    return this.#kind.isEnum() && this.#values !== undefined ? this.#values : null;
  }

  // 文言材料（binding 不適合文言の "${kind} attribute" 描画点）。
  kindLabel(): string {
    return this.#kind.asString();
  }

  // 境界: lowered 文書の描画と SMT 文脈（adapter）専用の読み手。
  description(): string | undefined {
    return this.#description;
  }

  minBound(): AttributeBound | undefined {
    return this.#min;
  }

  maxBound(): AttributeBound | undefined {
    return this.#max;
  }
}
