import { compareCanonically } from "@deep-spec/kernel-infrastructure";

// RequirementId — 要件 id（FR-1 / NFR-2 …）のドメインプリミティブ。requirements.md
// が宣言する id（RequirementIds）と、義務・シナリオ・規則がそれを指す参照
// （FrRefs、rules.md の source）は同じ語彙（種別規律の裁定 3-1、2026-09-03）。

export class RequirementId {
  readonly #value: string;

  private constructor(value: Parameters<typeof RequirementId.of>[0]) {
    this.#value = value;
  }

  static of(raw: string): RequirementId {
    return new RequirementId(raw);
  }

  equals(other: RequirementId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——finding の frRefs の並び。
  compareTo(other: RequirementId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
