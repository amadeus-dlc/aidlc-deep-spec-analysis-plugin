import {IllegalArgumentException} from "./illegal-argument-exception.ts";
import {type Result, err, ok} from "./result.ts";

// parse 専用のエラー境界。入力契約違反だけを値に変え、TypeError 等の
// 想定外の例外は送出し続ける。検証規則そのものは各コンストラクタが所有する。
export function parseConstruction<T>(construct: () => T): Result<T, IllegalArgumentException["problem"]> {
  try {
    return ok(construct());
  } catch (error) {
    if (error instanceof IllegalArgumentException) return err(error.problem);
    throw error;
  }
}
