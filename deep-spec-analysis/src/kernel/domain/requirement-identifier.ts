import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { type Result, IllegalArgumentException, parseConstruction, compareCanonically } from "@deep-spec/kernel-infrastructure";

// RequirementIdentifier — 要件 id（FR-1 / NFR-2 …）のドメインプリミティブ。requirements.md
// が宣言する id（RequirementIdentifiers）と、義務・シナリオ・規則がそれを指す参照
// （FunctionalRequirementReferences、rules.md の source）は同じ語彙（種別規律の裁定 3-1、2026-09-03）。

export class RequirementIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length > 128) throw new IllegalArgumentException({ kind: "requirement-id-too-long", raw: value.length });
    if (!/^(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*$/.test(value)) throw new IllegalArgumentException({ kind: "malformed-requirement-id", raw: value });
    this.#value = value;
  }

  static of(raw: string): RequirementIdentifier {
    return new RequirementIdentifier(raw);
  }

  static parse(raw: string): Result<RequirementIdentifier, ParseError> {
    return parseConstruction(() => new RequirementIdentifier(raw));
  }

  equals(other: RequirementIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——finding の frRefs の並び。
  compareTo(other: RequirementIdentifier): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
