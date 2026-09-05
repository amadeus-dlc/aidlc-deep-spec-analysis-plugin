import { IllegalArgumentException } from "./illegal-argument-exception.ts";

type SizedValue = null | boolean | number | string | readonly SizedValue[] | { readonly [key: string]: SizedValue };

// 再帰表現をコピーする前のサイズ計測。型の妥当性は検査せず、上限は呼び出すVOが決める。
export function assertValueSize(value: SizedValue, limits: { string: number; nodes: number; depth: number; total: number }): void {
  let nodes = 0;
  let total = 0;
  const visit = (current: SizedValue, depth: number): void => {
    if (++nodes > limits.nodes || depth > limits.depth) throw new IllegalArgumentException({ kind: "value-tree-too-large" });
    if (typeof current === "string") {
      if (current.length > limits.string) throw new IllegalArgumentException({ kind: "value-string-too-long", raw: current.length });
      total += current.length;
    } else if (current !== null && typeof current === "object") {
      if (Array.isArray(current)) {
        if (current.length > limits.nodes - nodes) throw new IllegalArgumentException({ kind: "value-tree-too-large" });
        for (const child of current) visit(child, depth + 1);
      } else {
        const record = current as { readonly [key: string]: SizedValue };
        for (const key in record) {
          if (!Object.hasOwn(record, key)) continue;
          if (key.length > limits.string) throw new IllegalArgumentException({ kind: "value-key-too-long", raw: key.length });
          total += key.length;
          if (total > limits.total) throw new IllegalArgumentException({ kind: "value-text-too-large" });
          visit(record[key], depth + 1);
        }
      }
    }
    if (total > limits.total) throw new IllegalArgumentException({ kind: "value-text-too-large" });
  };
  visit(value, 0);
}
