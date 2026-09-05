// 契約2（findings 文書）のスキーマを包む値オブジェクト。合成ルートが一度だけ
// 読んだ JSON Schema をこの値にして注入し、以後の適合判定はこの値からだけ導く
// ——schema ファイルが途中で変わっても、判定と保存文書は同じ値から導かれる
// （FR1.2／BR1.1）。
//
// 変種は 2 つ：読めた schema（of）と、読めなかった schema（unreadable）。
// 後者はすべての文書を降格させる——「検査できなかった」を「適合していた」と
// 取り違えないため。降格文言は golden 凍結なのでこの値が逐語で所有する。
// スキーマファイルの読込（I/O）はここには無い：それはアダプタの責務で、
// この値は読み終えた材料だけを受け取る。

import {
  type Json,
  type Schema,
  type ParseError,
  type Result,
  boundedValueSnapshot,
  parseConstruction,
  validateSchema,
} from "@deep-spec/kernel-infrastructure";

const CONTRACT_BASENAME = "deep-spec-findings-schema.json";

export class FindingsSchema {
  readonly #schema: Schema | null;
  readonly #reason: string | null;

  private constructor(schema: Schema | null, reason: string | null) {
    this.#schema = schema === null ? null : boundedValueSnapshot(schema, { string: 65_536, nodes: 100_000, depth: 128, total: 16_777_216 });
    this.#reason = reason;
  }

  // 読めたスキーマ。文書はこのスキーマで自己検証される。
  static of(schema: Schema): FindingsSchema {
    return new FindingsSchema(schema, null);
  }

  static parse(schema: Schema): Result<FindingsSchema, ParseError> {
    return parseConstruction(() => new FindingsSchema(schema, null));
  }

  // 読めなかったスキーマ。cause は捕捉した Error.message を逐語で運ぶ。
  static unreadable(cause: string): FindingsSchema {
    return new FindingsSchema(null, cause);
  }

  // 文書がこのスキーマに適合しないときだけ、降格理由（凍結文言）を返す。
  // 適合していれば null——「降格しない」を不在で表す。
  degradationReasonFor(document: { [k: string]: Json }): string | null {
    const schema = this.#schema;
    if (schema === null) {
      return `findings schema unreadable: ${this.#reason ?? ""}`;
    }
    const errors: string[] = [];
    validateSchema(schema, schema, document, "", errors);
    const first = errors[0];
    if (first === undefined) return null;
    return `self-validation against ${CONTRACT_BASENAME} failed: ${first}`;
  }
}
