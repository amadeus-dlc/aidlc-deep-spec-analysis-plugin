// 正準 JSON 直列化 — キー整列・配列順保存。irHash 系の入力バイトを决める
// ため 1 文字も変えてはならない。deep-spec-lib.ts からの逐語移動。
// I/O を一切持たない純関数なので最内層に置く（kernel/adapter からの移設）。

import type { Json } from "./json.ts";
import type { ValueSnapshotParam } from "./value-snapshot-param.ts";

export function canonicalStringify(value: ValueSnapshotParam): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as { readonly [key: string]: ValueSnapshotParam };
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Json値だけを構造比較する。オブジェクトのキー順は無視し、配列順は保持する。 */
export function jsonEquals(left: Json, right: Json): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
      if (!jsonEquals(left[index], right[index])) return false;
    }
    return true;
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || !jsonEquals(left[key], right[key])) return false;
  }
  return true;
}
