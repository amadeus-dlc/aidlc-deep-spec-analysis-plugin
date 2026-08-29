// KIND_RANK 順序保存の機械証明（issue #13 / 親 #12）。
//
// リポジトリには 2 系統の rank 表が存在する:
//   - v1 バックエンド（verify-smt / verify-quint）: 4 kind、未知は 9
//   - 共有 lib / design-lib: 11 kind、未知は 99
// 将来の統一が byte-safe であるための必要条件は「v1 が出力し得る全 kind
// 対で相対順序が一致し、かつ未知 fallback が既知 rank を全て超える」こと。
// 表は非公開 const のため、ソーステキストから正規表現で抽出して照合する
// （転記ではなく実コードに紐づいた証明にするため）。

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tools");

function extractKindRank(file: string): { table: Map<string, number>; fallback: number } {
  const source = readFileSync(join(toolsDir, file), "utf-8");
  const block = source.match(/const KIND_RANK[^=]*=\s*\{([\s\S]*?)\};/);
  if (!block) throw new Error(`${file}: KIND_RANK table not found`);
  const table = new Map<string, number>();
  for (const entry of block[1].matchAll(/"?([a-z-]+)"?\s*:\s*(\d+)/g)) {
    table.set(entry[1], Number(entry[2]));
  }
  const fallbackMatch = source.match(/KIND_RANK\[[^\]]+\]\s*\?\?\s*(\d+)/);
  if (!fallbackMatch) throw new Error(`${file}: KIND_RANK fallback not found`);
  return { table, fallback: Number(fallbackMatch[1]) };
}

const V1_FILES = ["aidlc-sensor-deep-spec-verify-smt.ts", "aidlc-sensor-deep-spec-verify-quint.ts"];
const EXTENDED_FILES = ["deep-spec-lib.ts", "deep-spec-design-lib.ts"];

describe("kind-rank order preservation", () => {
  test("the two v1 backend tables are identical", () => {
    const [smt, quint] = V1_FILES.map(extractKindRank);
    expect([...smt.table.entries()].sort()).toEqual([...quint.table.entries()].sort());
    expect(smt.fallback).toBe(quint.fallback);
  });

  test("the two extended tables are identical", () => {
    const [lib, design] = EXTENDED_FILES.map(extractKindRank);
    expect([...lib.table.entries()].sort()).toEqual([...design.table.entries()].sort());
    expect(lib.fallback).toBe(design.fallback);
  });

  test("the extended table preserves the relative order of every v1 kind pair", () => {
    const v1 = extractKindRank(V1_FILES[0]);
    const extended = extractKindRank(EXTENDED_FILES[0]);
    const kinds = [...v1.table.keys()];
    expect(kinds.length).toBe(4);
    for (const a of kinds) {
      expect(extended.table.has(a)).toBe(true);
      for (const b of kinds) {
        const v1Sign = Math.sign((v1.table.get(a) ?? v1.fallback) - (v1.table.get(b) ?? v1.fallback));
        const extSign = Math.sign((extended.table.get(a) ?? extended.fallback) - (extended.table.get(b) ?? extended.fallback));
        expect(`${a} vs ${b}: ${extSign}`).toBe(`${a} vs ${b}: ${v1Sign}`);
      }
    }
  });

  test("both unknown fallbacks exceed every known rank in their table", () => {
    for (const file of [...V1_FILES, ...EXTENDED_FILES]) {
      const { table, fallback } = extractKindRank(file);
      // fallback は歴史的な固定値（v1=9・拡張=99）。golden に効く定数なので
      // 「既知 rank より大きい」だけでなく値そのものを固定する。
      expect(fallback).toBe(V1_FILES.includes(file) ? 9 : 99);
      for (const [kind, rank] of table) {
        expect(`${file} ${kind} ${rank < fallback}`).toBe(`${file} ${kind} true`);
      }
    }
  });
});
