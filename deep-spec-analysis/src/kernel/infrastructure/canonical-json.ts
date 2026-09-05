// 正準 JSON 直列化 — キー整列・配列順保存。irHash 系の入力バイトを决める
// ため 1 文字も変えてはならない。deep-spec-lib.ts からの逐語移動。
// I/O を一切持たない純関数なので最内層に置く（kernel/adapter からの移設）。

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
