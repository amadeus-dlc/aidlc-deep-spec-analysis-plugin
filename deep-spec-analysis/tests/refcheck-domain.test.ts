// refcheck/domain の単体テスト（DDD 移行 PR2a、issue #15）。
// カタログ順序は golden バイトを決める凍結挙動——順位・タイブレークを固定する。

import { describe, expect, test } from "bun:test";
import { CATALOG_VERSION, type Finding, type Skipped, sortFindings, sortSkipped } from "../tools/refcheck/domain/index.ts";

function finding(kind: string, targets: string[], detail: string): Finding {
  return { kind, frRefs: [], targets, witness: { refs: [] }, detail };
}

describe("catalog-order", () => {
  test("findings sort by the extended kind rank, then joined targets, then detail", () => {
    const sorted = sortFindings([
      finding("cross-check-disagreement", ["SC-1"], "z"),
      finding("structure-invalid", ["check:DD-0"], "b"),
      finding("structure-invalid", ["check:DD-0"], "a"),
      finding("reference-broken", ["component:A"], "x"),
      finding("conflict", ["OB-9"], "y"),
    ]);
    expect(sorted.map((f) => `${f.kind}/${f.detail}`)).toEqual([
      "conflict/y",
      "structure-invalid/a",
      "structure-invalid/b",
      "reference-broken/x",
      "cross-check-disagreement/z",
    ]);
  });

  test("an unknown kind ranks after every catalogued kind (fallback 99)", () => {
    const sorted = sortFindings([finding("mystery-kind", ["X-1"], "m"), finding("cross-check-disagreement", ["SC-1"], "c")]);
    expect(sorted[0]?.kind).toBe("cross-check-disagreement");
  });

  test("a prototype-inherited name as kind falls back like any unknown kind (no NaN ranks)", () => {
    const sorted = sortFindings([
      finding("toString", ["X-1"], "t"),
      finding("constructor", ["X-2"], "c"),
      finding("conflict", ["OB-1"], "k"),
    ]);
    expect(sorted[0]?.kind).toBe("conflict");
    // 両者とも fallback 99 で同順位 → targets 文字列比較で "X-1" が先。
    expect(sorted.slice(1).map((f) => f.kind)).toEqual(["toString", "constructor"]);
  });

  test("skips sort by id order on target, then by reason", () => {
    const skips: Skipped[] = [
      { target: "check:FD-E10", reason: "b" },
      { target: "check:FD-E2", reason: "a" },
      { target: "check:FD-E2", reason: "A" },
    ];
    expect(sortSkipped(skips).map((s) => `${s.target}/${s.reason}`)).toEqual([
      "check:FD-E2/A",
      "check:FD-E2/a",
      "check:FD-E10/b",
    ]);
  });

  test("the catalog version pins the contract line refcheck documents declare", () => {
    expect(CATALOG_VERSION).toBe("1.0.0");
  });
});
