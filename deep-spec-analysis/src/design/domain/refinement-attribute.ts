import type { AttributePath } from "@deep-spec/requirements-domain";
import type { ReqAttributeValues } from "./req-attribute-values.ts";

// 要件 IR の属性宣言の refinement 面——パス・種類・enum の宣言値。計画は
// パスの一致と enum かどうかを問い、enumMap の値域検査に宣言値を渡す
// （#71 波24。誰も読まなかった min/max はここで落とす）。
export class RefinementAttribute {
  readonly #path: AttributePath;
  readonly #kind: "bool" | "int" | "enum";
  readonly #values: ReqAttributeValues | undefined;

  private constructor(props: { path: AttributePath; kind: "bool" | "int" | "enum"; values?: ReqAttributeValues }) {
    this.#path = props.path;
    this.#kind = props.kind;
    this.#values = props.values;
  }

  static reconstitute(props: { path: AttributePath; kind: "bool" | "int" | "enum"; values?: ReqAttributeValues }): RefinementAttribute {
    return new RefinementAttribute(props);
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

  declaredValues(): ReqAttributeValues | undefined {
    return this.#values;
  }
}
