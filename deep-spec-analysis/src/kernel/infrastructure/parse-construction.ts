import {IllegalArgumentException} from "./illegal-argument-exception.ts";
import {type Result, err, ok} from "./result.ts";
import type { ParseError } from "./parse-error.ts";

// parse 専用のエラー境界。入力契約違反だけを値に変え、TypeError 等の
// 想定外の例外は送出し続ける。検証規則そのものは各コンストラクタが所有する。
export function parseConstruction<T>(construct: () => T): Result<T, ParseError> {
  try {
    return ok(construct());
  } catch (error) {
    if (error instanceof IllegalArgumentException) {
      const failure: ParseError = Object.freeze({
        kind: error.problem.kind,
        ...(error.problem.raw === undefined ? {} : { raw: error.problem.raw }),
      });
      return err(failure);
    }
    throw error;
  }
}
