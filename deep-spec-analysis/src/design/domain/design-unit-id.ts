import { type Result, IllegalArgumentException, parseConstruction } from "@deep-spec/kernel-infrastructure";
// DesignModel内のユニット識別子。非空の名前を保持し、
// 生値からの入力失敗はparse、内部の生成契約違反はofのpanicで扱う。

export class DesignUnitId {
  readonly #value: string;

  private constructor(value: string) {
    if (value === "") throw new IllegalArgumentException({ kind: "empty-design-unit-id", raw: value });
    this.#value = value;
  }

  static of(value: string): DesignUnitId {
    return new DesignUnitId(value);
  }

  static parse(raw: string): Result<DesignUnitId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignUnitId(raw));
  }

  equals(other: DesignUnitId): boolean {
    return this.#value === other.#value;
  }

  // 境界: 文書・文言・写像キーに逐語で載るユニット名。
  asString(): string {
    return this.#value;
  }
}
