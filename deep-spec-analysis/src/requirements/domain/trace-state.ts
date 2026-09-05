// TraceState — トレースの 1 状態（属性パス → 値）の値オブジェクト（種別規律の
// 裁定 2、2026-09-03）。参照の解決（`valueAt`——無い参照は absent）は状態自身
// の知識で、評価器はこれを問うだけ。挿入順は文書のキー順（復号器のソート順、
// scenario binding の正準順）で、`toDocument` がその順で逐語に降りる。

import { type AttributePath, KeyedIndex } from "@deep-spec/kernel-domain";
import { TraceValue } from "./trace-value.ts";

export class TraceState {
  readonly #values: KeyedIndex<AttributePath, TraceValue>;

  private constructor(values: KeyedIndex<AttributePath, TraceValue>) {
    this.#values = values;
  }

  static empty(): TraceState {
    return new TraceState(KeyedIndex.empty());
  }

  static of(entries: Iterable<readonly [AttributePath, TraceValue]>): TraceState {
    return new TraceState(KeyedIndex.of(entries));
  }

  // 参照の解決——無い参照は absent（null）。凍結挙動。
  valueAt(path: AttributePath): TraceValue {
    return this.#values.get(path) ?? TraceValue.absent();
  }

  // 境界: witness の trace 1 状態として逐語に降りる（挿入順）。
  toDocument(): { [path: string]: ReturnType<TraceValue["toDocument"]> } {
    const out: { [path: string]: ReturnType<TraceValue["toDocument"]> } = {};
    for (const [path, value] of this.#values) out[path.asString()] = value.toDocument();
    return out;
  }
}
