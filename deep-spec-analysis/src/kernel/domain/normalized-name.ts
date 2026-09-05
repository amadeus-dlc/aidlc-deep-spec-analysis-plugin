import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
// 成果物横断の名前照合（XS 検査）に使う正規化名——小文字化し英数字以外を落とす
// ので "OrderItem" と "order_item" は同じ名になる。正規化規則と同一性は
// この DP が所有する（種別規律の裁定 3、2026-09-02——旧随伴 class `Names` を
// 吸収）。requirements / design / refcheck が同じ語彙で話すため kernel が持つ。
export class NormalizedName {
  readonly #value: string;

  /** 元の名前・列挙リテラルと同じ4,096コード単位の処理予算。 単位はUTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length > 4096) throw new IllegalArgumentException({ kind: "normalized-name-too-long", raw: value.length });
    this.#value = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  static of(raw: string): NormalizedName {
    return new NormalizedName(raw);
  }

  equals(other: NormalizedName): boolean {
    return this.#value === other.#value;
  }

  // 索引のキーに使う正規化済みトークン。
  asString(): string {
    return this.#value;
  }
}
