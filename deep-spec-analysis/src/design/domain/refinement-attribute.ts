import type { EnumerationMembers } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfNullable, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";
import type { AttributePath } from "@deep-spec-analysis/requirements-domain";

// 要件 IR の属性宣言の refinement 面——パス・種類・enum の宣言値。計画は
// パスの一致と enum かどうかを問い、enumMap の値域検査に宣言値を渡す
// （#71 波24。誰も読まなかった min/max はここで落とす）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementAttributeParam = { path: AttributePath; kind: "bool" | "int" | "enum"; values?: EnumerationMembers };

export class RefinementAttribute {
  readonly #path: AttributePath;
  readonly #kind: "bool" | "int" | "enum";
  readonly #values: EnumerationMembers | undefined;

  private constructor(props: RefinementAttributeParam) {
    this.#path = props.path;
    this.#kind = props.kind;
    this.#values = props.values;
  }

  static of(props: RefinementAttributeParam): RefinementAttribute {
    return new RefinementAttribute(props);
  }

  equals(other: RefinementAttribute): boolean {
    const left = this.#values;
    const right = other.#values;
    return (
      this.#path.asString() === other.#path.asString() &&
      this.#kind === other.#kind &&
      (left === undefined || right === undefined ? left === right : left.equals(right))
    );
  }

  hashCode(): number {
    return combinedHash([
      hashOfString(this.#path.asString()),
      hashOfString(this.#kind),
      hashOfNullable(this.#values, (values) => values.hashCode()),
    ]);
  }

  path(): AttributePath {
    return this.#path;
  }

  isAt(path: AttributePath | string): boolean {
    return this.#path.asString() === (typeof path === "string" ? path : path.asString());
  }

  kind(): "bool" | "int" | "enum" {
    return this.#kind;
  }

  isEnum(): boolean {
    return this.#kind === "enum";
  }

  declaredValues(): EnumerationMembers | undefined {
    return this.#values;
  }
}
