import { EnumerationMembers } from "@deep-spec/kernel-domain";
export { AttributeBound } from "@deep-spec/kernel-domain";
import { AttributeBound } from "@deep-spec/kernel-domain";
import { AttributePath } from "@deep-spec/kernel-domain";



// 要件 IR の属性宣言——パス・種類（bool／int／enum）・int の上下限・enum の
// 宣言値。コンパイラは種類で分岐する代わりに `match` で種類ごとの材料を
// 受け取る（#71 波25）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RequirementAttributeDeclarationParam = { path: AttributePath; kind: "bool" | "int" | "enum"; min?: AttributeBound; max?: AttributeBound; values?: EnumerationMembers };

export class RequirementAttributeDeclaration {
  readonly #path: AttributePath;
  readonly #kind: "bool" | "int" | "enum";
  readonly #min: AttributeBound | undefined;
  readonly #max: AttributeBound | undefined;
  readonly #values: EnumerationMembers | undefined;

  private constructor(props: RequirementAttributeDeclarationParam) {
    this.#path = props.path;
    this.#kind = props.kind;
    this.#min = props.min;
    this.#max = props.max;
    this.#values = props.values;
  }

  static of(props: RequirementAttributeDeclarationParam): RequirementAttributeDeclaration {
    return new RequirementAttributeDeclaration(props);
  }

  path(): AttributePath {
    return this.#path;
  }

  isAt(path: string): boolean {
    return this.#path.asString() === path;
  }

  isBool(): boolean {
    return this.#kind === "bool";
  }

  isInt(): boolean {
    return this.#kind === "int";
  }

  isEnum(): boolean {
    return this.#kind === "enum";
  }

  // enum の宣言値。enum でない、または宣言がなければ undefined。
  declaredValues(): EnumerationMembers | undefined {
    return this.#values;
  }

  minBound(): AttributeBound | undefined {
    return this.#min;
  }

  maxBound(): AttributeBound | undefined {
    return this.#max;
  }

  // 種類ごとの解釈へ命じる。int には上下限（宣言がなければ undefined）、
  // enum には宣言値（なければ undefined）を渡す。
  match<T>(handlers: {
    bool: () => T;
    int: (min: AttributeBound | undefined, max: AttributeBound | undefined) => T;
    enum: (values: EnumerationMembers | undefined) => T;
  }): T {
    if (this.#kind === "bool") return handlers.bool();
    if (this.#kind === "int") return handlers.int(this.#min, this.#max);
    return handlers.enum(this.#values);
  }
}
