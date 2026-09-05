import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class ComponentName {
  readonly #value: string;
  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "component-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): ComponentName {
    return new ComponentName(raw);
  }

  static parse(raw: string): Result<ComponentName, ParseError> {
    return parseConstruction(() => new ComponentName(raw));
  }
  equals(other: ComponentName): boolean { return this.#value === other.#value; }
  // 正準順（裁定 1）——kernel の TargetIdentifier が所有する順序に従う。
  compareTo(other: ComponentName): number { return compareCanonically(this.#value, other.#value); }
  asString(): string { return this.#value; }
}
