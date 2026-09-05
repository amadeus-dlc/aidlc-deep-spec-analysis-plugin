import type {ContentHash} from "./content-hash.ts";

// 文書に記されたダイジェストの原文。検証済み ContentHash へ昇格させず、
// 実測値との一致・不一致を判断するための入力として保持する。
export class DeclaredDigest {
  readonly #value: string;

  private constructor(value: Parameters<typeof DeclaredDigest.of>[0]) { this.#value = value; }

  static of(value: string): DeclaredDigest { return new DeclaredDigest(value); }

  asString(): string { return this.#value; }

  matches(actual: ContentHash): boolean { return this.#value === actual.asString(); }
}
