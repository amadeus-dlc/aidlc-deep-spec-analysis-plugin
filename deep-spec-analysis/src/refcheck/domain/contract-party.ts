// contracts テーブルの Provider / Consumer / Owner セルの値。空欄・
// `External: …` 宣言の判別はセル自身の知識（CD-1 の凍結挙動）。
export class ContractParty {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): ContractParty {
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
