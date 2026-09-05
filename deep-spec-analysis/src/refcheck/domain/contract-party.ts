import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// contracts テーブルの Provider / Consumer / Owner セルの値。空欄・
// `External: …` 宣言の判別はセル自身の知識（CD-1 の凍結挙動）。
export class ContractParty {
  readonly #value: string;

  /** 4096 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 4096) throw new IllegalArgumentException({ kind: "contract-party-too-long", raw: value.length });

    this.#value = value.replace(/[`*]/g, "").trim();
  }

  static parse(value: string): Result<ContractParty, ParseError> {
    return parseConstruction(() => new ContractParty(value));
  }

  static of(raw: string): ContractParty {
    return new ContractParty(raw);
  }

  equals(other: ContractParty): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isBlank(): boolean {
    return this.#value === "";
  }

  declaresExternal(): boolean {
    return /^external\b/i.test(this.#value);
  }
}
