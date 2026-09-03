// AttributeKind — IR（契約1／契約3）の属性型区分（bool / int / enum）の
// ドメインプリミティブ（種別規律の裁定 3-2、2026-09-03）。型宣言が欠けた属性は
// 空の区分で届く（旧実装はカタログへ登録した——参照解決の可否が変わるため保存）。

export class AttributeKind {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): AttributeKind {
    return new AttributeKind(raw);
  }

  equals(other: AttributeKind): boolean {
    return this.#value === other.#value;
  }

  isBool(): boolean {
    return this.#value === "bool";
  }

  isInt(): boolean {
    return this.#value === "int";
  }

  isEnum(): boolean {
    return this.#value === "enum";
  }

  // 凍結文言の材料（`does not fit ${kind} attribute` 等）。
  asString(): string {
    return this.#value;
  }
}
