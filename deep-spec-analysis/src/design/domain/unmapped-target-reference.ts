import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// unmapped[].target の宣言トークン——要件属性パス・義務 id・シナリオ id の
// どれをも指しうる契約4 の waiver 語彙。
export class UnmappedTargetReference {
  readonly #value: string;

  /** 属性パスまたは対象IDを収める宣言参照の上限。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 1024) throw new IllegalArgumentException({ kind: "unmapped-target-ref-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-refinement-map-token", raw });
    this.#value = raw;
  }

  static of(raw: string): UnmappedTargetReference {
    return new UnmappedTargetReference(raw);
  }

  static parse(raw: string): Result<UnmappedTargetReference, ParseError> {
    return parseConstruction(() => new UnmappedTargetReference(raw));
  }

  equals(other: UnmappedTargetReference): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
