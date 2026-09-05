import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// unmapped[].target の宣言トークン——要件属性パス・義務 id・シナリオ id の
// どれをも指しうる契約4 の waiver 語彙。
export class UnmappedTargetRef {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-refinement-map-token", raw });
    this.#value = raw;
  }

  static of(raw: string): UnmappedTargetRef {
    return new UnmappedTargetRef(raw);
  }

  static parse(raw: string): Result<UnmappedTargetRef, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new UnmappedTargetRef(raw));
  }

  equals(other: UnmappedTargetRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
