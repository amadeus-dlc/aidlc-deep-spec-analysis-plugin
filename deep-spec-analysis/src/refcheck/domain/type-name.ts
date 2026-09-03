import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

const NUMERICISH = new Set(["int", "integer", "number", "decimal", "float", "double", "long"]);

const DATEISH = new Set(["date", "datetime", "timestamp", "time"]);

const COLLECTIONISH = new Set(["list", "array", "map", "object", "collection", "set"]);

const BOOLISH = new Set(["bool", "boolean"]);

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class TypeName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<TypeName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new TypeName(raw));
  }
  static reconstitute(raw: string): TypeName { return new TypeName(raw); }
  equals(other: TypeName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // 型区分（numeric/date/bool/…）の照合は小文字正規化で行う（凍結挙動）。
  normalized(): string { return this.#value.toLowerCase(); }
  // 型区分の分類は型名語彙の知識（旧 functional-checks のローカル集合の移設）。
  classifiesNumeric(): boolean { return NUMERICISH.has(this.normalized()); }
  classifiesDate(): boolean { return DATEISH.has(this.normalized()); }
  classifiesBool(): boolean { return BOOLISH.has(this.normalized()); }
  classifiesCollection(): boolean { return COLLECTIONISH.has(this.normalized()); }
}
