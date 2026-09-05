import { IllegalArgumentException } from "./illegal-argument-exception.ts";
import type { ValueSnapshotParam } from "./value-snapshot-param.ts";

// サイズを確かめた要素だけをコピーする。入力の各値は一度だけ読み取り、
// 検査後に元データを読み直さない。部分的なコピーも指定予算内に収める。
export function boundedValueSnapshot<T extends ValueSnapshotParam>(
  value: T,
  limits: { string: number; nodes: number; depth: number; total: number },
): T {
  let nodes = 0;
  let total = 0;
  const chargeText = (text: string, kind: string): void => {
    if (text.length > limits.string) throw new IllegalArgumentException({ kind, raw: text.length });
    total += text.length;
    if (total > limits.total) throw new IllegalArgumentException({ kind: "value-text-too-large" });
  };
  const copy = (current: ValueSnapshotParam, depth: number): ValueSnapshotParam => {
    if (++nodes > limits.nodes || depth > limits.depth)
      throw new IllegalArgumentException({ kind: "value-tree-too-large" });
    if (typeof current === "string") {
      chargeText(current, "value-string-too-long");
      return current;
    }
    if (current === null || typeof current !== "object") return current;
    if (Array.isArray(current)) {
      const count = current.length;
      if (count > limits.nodes - nodes) throw new IllegalArgumentException({ kind: "value-tree-too-large" });
      const values: ValueSnapshotParam[] = [];
      for (let index = 0; index < count; index++) values.push(copy(current[index], depth + 1));
      return values;
    }
    const record = current as { readonly [key: string]: ValueSnapshotParam };
    const entries: [string, ValueSnapshotParam][] = [];
    for (const key in record) {
      if (!Object.hasOwn(record, key)) continue;
      chargeText(key, "value-key-too-long");
      entries.push([key, copy(record[key], depth + 1)]);
    }
    // __proto__なども、プロトタイプ操作ではなく通常の文書プロパティとしてコピーする。
    return Object.fromEntries(entries);
  };
  // データの形と値を維持したコピー。VOやクラスのインスタンスは引数の型に含まれない。
  return copy(value, 0) as T;
}
