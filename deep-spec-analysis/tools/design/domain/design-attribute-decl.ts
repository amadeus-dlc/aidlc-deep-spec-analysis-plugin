import type { AttributeBound } from "../../kernel/domain/index.ts";
import type { DeclaredValues } from "./declared-values.ts";
import { type DesignAttributeName } from "./design-attribute-name.ts";
import type { DesignAttributeDeclSeed } from "./design-attribute-decl-seed.ts";

// 属性宣言（bool / 有界 int / enum）。型宣言が欠けた属性は kind: "" で届く
//（旧実装はカタログへ登録した——参照解決の可否が変わるため保存）。
// 主従の裁定（2026-09-01、#71 波1）: 宣言は命令できる抽象データ型——
// well-formedness の判事が吸い出していた判断（bounds 三態・binding 適合・
// enum リテラル所属・machine 状態面）を宣言自身が所有し、プロパティ読みは
// 構築ドア（I/O 文脈）だけに残る。文言と発生順は判事側の凍結面のまま。
export class DesignAttributeDecl {
  readonly #name: DesignAttributeName;
  readonly #kind: string;
  readonly #values: DeclaredValues | undefined;
  readonly #min: AttributeBound | undefined;
  readonly #max: AttributeBound | undefined;

  private constructor(seed: DesignAttributeDeclSeed) {
    this.#name = seed.name;
    this.#kind = seed.kind;
    this.#values = seed.values;
    this.#min = seed.min;
    this.#max = seed.max;
  }

  static reconstitute(seed: DesignAttributeDeclSeed): DesignAttributeDecl {
    return new DesignAttributeDecl(seed);
  }

  // 同定面（座標組み立て・重複検査の材料）。
  name(): DesignAttributeName {
    return this.#name;
  }

  // int 属性に必須の有界性（Quint backend の有限領域要件）を欠くか。
  lacksIntBounds(): boolean {
    return this.#kind === "int" && (this.#min === undefined || this.#max === undefined);
  }

  boundsInverted(): boolean {
    return this.#kind === "int" && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }

  boundsOutsideSafeRange(): boolean {
    return (
      (this.#min !== undefined && !Number.isSafeInteger(this.#min.asNumber())) ||
      (this.#max !== undefined && !Number.isSafeInteger(this.#max.asNumber()))
    );
  }

  isEnum(): boolean {
    return this.#kind === "enum";
  }

  admitsEnumLiteral(value: string): boolean {
    return this.#kind === "enum" && (this.#values?.includes(value) ?? false);
  }

  // scenario binding の適合（bool / 安全整数 int / 宣言済み enum 値）。
  fitsBinding(value: unknown): boolean {
    return (
      (this.#kind === "bool" && typeof value === "boolean") ||
      (this.#kind === "int" && typeof value === "number" && Number.isSafeInteger(value)) ||
      (this.#kind === "enum" && typeof value === "string" && (this.#values?.includes(value) ?? false))
    );
  }

  // machine の状態集合面——enum でなければ null（判事が凍結文言で報告する）。
  enumStates(): DeclaredValues | null {
    return this.#kind === "enum" && this.#values !== undefined ? this.#values : null;
  }

  // 文言材料（binding 不適合文言の "${kind} attribute" 描画点）。
  kindLabel(): string {
    return this.#kind;
  }
}
