
// finding.kind の正準順位——契約2 の findings 並びの土台。順位表は kernel の
// FindingKind が 1 つだけ所有する（種別規律の裁定 3-2、2026-09-03——旧 5 表の
// lockstep 証明はこの単一表の性質の証明に置き換わった）。
//
//   - 11 種の順位は凍結（v1 が出力し得る 4 種の相対順序もこの表のとおり）
//   - 未知の kind は生成できず、parse はエラーを返す
// of は契約違反を送出し、parse は同じ違反を Result に変換する。

import { describe, expect, test } from "bun:test";
import { FindingKind } from "@deep-spec/kernel-domain";

const FROZEN_ORDER = [
  "conflict",
  "completeness-gap",
  "scenario-violation",
  "unreachable",
  "redundancy",
  "refinement-violation",
  "mapping-gap",
  "structure-invalid",
  "reference-broken",
  "consistency-mismatch",
  "cross-check-disagreement",
];

describe("finding kind order preservation", () => {
  test("the eleven kinds keep their frozen canonical order", () => {
    expect(FindingKind.canonicalOrder()).toEqual(FROZEN_ORDER);
    for (let i = 0; i < FROZEN_ORDER.length; i++) {
      for (let j = 0; j < FROZEN_ORDER.length; j++) {
        const c = FindingKind.of(FROZEN_ORDER[i] ?? "").compareTo(FindingKind.of(FROZEN_ORDER[j] ?? ""));
        expect(Math.sign(c)).toBe(Math.sign(i - j));
      }
    }
  });

  test("the v1 backends' four kinds keep their relative order", () => {
    const v1 = ["conflict", "completeness-gap", "scenario-violation", "cross-check-disagreement"];
    for (let i = 0; i < v1.length; i++) {
      for (let j = i + 1; j < v1.length; j++) {
        expect(FindingKind.of(v1[i] ?? "").compareTo(FindingKind.of(v1[j] ?? ""))).toBeLessThan(0);
      }
    }
  });

  test("unknown kinds fail without entering the rank table", () => {
    for (const raw of ["no-such-kind", "toString"]) {
      const result = FindingKind.parse(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.raw).toBe(raw);
    }
    expect(FindingKind.conflict().isConflict()).toBe(true);
    expect(FindingKind.conflict().equals(FindingKind.of("conflict"))).toBe(true);
  });
});
