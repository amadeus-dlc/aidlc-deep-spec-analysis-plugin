// finding.kind の正準順位——契約2 の findings 並びの土台。順位表は kernel の
// FindingKind が 1 つだけ所有する（種別規律の裁定 3-2、2026-09-03——旧 5 表の
// lockstep 証明はこの単一表の性質の証明に置き換わった）。
//
//   - 11 種の順位は凍結（v1 が出力し得る 4 種の相対順序もこの表のとおり）
//   - 未知の kind は既知のどれよりも後ろ（不適合文書の降格試験がそれを運ぶ）
//   - parse は閉集合、reconstitute は逐語

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
        const c = FindingKind.reconstitute(FROZEN_ORDER[i] ?? "").compareTo(FindingKind.reconstitute(FROZEN_ORDER[j] ?? ""));
        expect(Math.sign(c)).toBe(Math.sign(i - j));
      }
    }
  });

  test("the v1 backends' four kinds keep their relative order", () => {
    const v1 = ["conflict", "completeness-gap", "scenario-violation", "cross-check-disagreement"];
    for (let i = 0; i < v1.length; i++) {
      for (let j = i + 1; j < v1.length; j++) {
        expect(FindingKind.reconstitute(v1[i] ?? "").compareTo(FindingKind.reconstitute(v1[j] ?? ""))).toBeLessThan(0);
      }
    }
  });

  test("an unknown kind sorts after every known kind, parses as an error, and reconstitutes verbatim", () => {
    const unknown = FindingKind.reconstitute("no-such-kind");
    for (const known of FROZEN_ORDER) expect(unknown.compareTo(FindingKind.reconstitute(known))).toBeGreaterThan(0);
    expect(unknown.compareTo(FindingKind.reconstitute("toString"))).toBe(0);
    expect(FindingKind.parse("no-such-kind").ok).toBe(false);
    expect(FindingKind.parse("conflict").ok).toBe(true);
    expect(unknown.asString()).toBe("no-such-kind");
    expect(FindingKind.reconstitute("conflict").isConflict()).toBe(true);
    expect(FindingKind.reconstitute("conflict").equals(FindingKind.reconstitute("conflict"))).toBe(true);
  });
});
