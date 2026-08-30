// 集約 ID と ArtifactPath の DP 検査（Repository 裁定・補遺の証人）。
// parse は境界の唯一の構築口、ID は of/ofModel が唯一の構築口で、
// equals は値による恒等比較。domain 90% 床のための分岐網羅。

import { describe, expect, test } from "bun:test";
import { ArtifactPath, ContentHash, IrVersion, sha256 } from "../tools/kernel/domain/index.ts";
import { DesignModelId, DesignUnitId, RefinementMaterialsId } from "../tools/design/domain/index.ts";
import { RefinementMapId } from "../tools/refinement/domain/index.ts";
import { DesignRecordId } from "../tools/refcheck/domain/index.ts";
import { FormalModelId } from "../tools/requirements/domain/index.ts";

function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

describe("ArtifactPath", () => {
  test("parse rejects the empty string with a materials-only error", () => {
    const parsed = ArtifactPath.parse("");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toEqual({ kind: "empty-path" });
  });

  test("parse accepts any non-empty path and keeps the raw value", () => {
    const parsed = ArtifactPath.parse("/a/b.md");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.value()).toBe("/a/b.md");
  });

  test("equals compares by value", () => {
    expect(ap("/a").equals(ap("/a"))).toBe(true);
    expect(ap("/a").equals(ap("/b"))).toBe(false);
  });
});

describe("aggregate ids resolve forward, by their own identity", () => {
  test("FormalModelId", () => {
    const id = FormalModelId.of(ap("/r/model.md"));
    expect(id.artifactPath().value()).toBe("/r/model.md");
    expect(id.equals(FormalModelId.of(ap("/r/model.md")))).toBe(true);
    expect(id.equals(FormalModelId.of(ap("/r/other.md")))).toBe(false);
  });

  test("DesignModelId", () => {
    const id = DesignModelId.of(ap("/r/design.md"));
    expect(id.artifactPath().value()).toBe("/r/design.md");
    expect(id.equals(DesignModelId.of(ap("/r/design.md")))).toBe(true);
    expect(id.equals(DesignModelId.of(ap("/r/other.md")))).toBe(false);
  });

  test("RefinementMaterialsId is anchored 1:1 to its design model", () => {
    const model = DesignModelId.of(ap("/r/design.md"));
    const id = RefinementMaterialsId.ofModel(model);
    expect(id.modelArtifactPath().value()).toBe("/r/design.md");
    expect(id.equals(RefinementMaterialsId.ofModel(model))).toBe(true);
    expect(id.equals(RefinementMaterialsId.ofModel(DesignModelId.of(ap("/r/other.md"))))).toBe(false);
  });

  test("DesignRecordId", () => {
    const id = DesignRecordId.of(ap("/r/components.md"));
    expect(id.artifactPath().value()).toBe("/r/components.md");
    expect(id.equals(DesignRecordId.of(ap("/r/components.md")))).toBe(true);
    expect(id.equals(DesignRecordId.of(ap("/r/contract-summary.md")))).toBe(false);
  });
});

describe("DesignUnitId and RefinementMapId", () => {
  test("DesignUnitId is the unit entity's identity, compared by value", () => {
    const id = DesignUnitId.of("u1-orders");
    expect(id.value()).toBe("u1-orders");
    expect(id.equals(DesignUnitId.of("u1-orders"))).toBe(true);
    expect(id.equals(DesignUnitId.of("u2-billing"))).toBe(false);
  });

  test("RefinementMapId is the contract-4 map aggregate's identity", () => {
    const id = RefinementMapId.of(ap("/r/deep-spec-analysis-refinement-map.md"));
    expect(id.artifactPath().value()).toBe("/r/deep-spec-analysis-refinement-map.md");
    expect(id.equals(RefinementMapId.of(ap("/r/deep-spec-analysis-refinement-map.md")))).toBe(true);
    expect(id.equals(RefinementMapId.of(ap("/other/deep-spec-analysis-refinement-map.md")))).toBe(false);
  });
});

describe("ContentHash", () => {
  test("parse accepts exactly 64 lowercase hex chars", () => {
    const ok = ContentHash.parse("a".repeat(64));
    expect(ok.ok).toBe(true);
    for (const bad of ["", "A".repeat(64), "a".repeat(63), "g".repeat(64)]) {
      const parsed = ContentHash.parse(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toEqual({ kind: "not-a-sha256-hex", raw: bad });
    }
  });

  test("ofText matches the known digest of the empty string, and equals compares by value", () => {
    expect(ContentHash.ofText("").value()).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("").equals(ContentHash.ofText(""))).toBe(true);
    expect(ContentHash.ofBytes(new Uint8Array([])).equals(sha256(""))).toBe(true);
    expect(sha256("a").equals(sha256("b"))).toBe(false);
  });

  test("reconstitute is the verbatim rehydration door for frozen documents", () => {
    expect(ContentHash.reconstitute("").value()).toBe("");
  });
});

describe("IrVersion", () => {
  test("parse accepts exactly major.minor.patch", () => {
    const ok = IrVersion.parse("1.2.3");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.value()).toBe("1.2.3");
      expect(ok.value.majorVersion()).toBe(1);
      expect(ok.value.supportsMajor(1)).toBe(true);
      expect(ok.value.supportsMajor(2)).toBe(false);
    }
    for (const bad of ["", "1.2", "v1.2.3", "1.2.3-rc1"]) {
      const parsed = IrVersion.parse(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toEqual({ kind: "not-a-semver", raw: bad });
    }
  });

  test("parse keeps the frozen legacy pattern: leading zeros are accepted (strict SemVer is the PR10 lift)", () => {
    const parsed = IrVersion.parse("01.2.3");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.majorVersion()).toBe(1);
  });

  test("reconstitute preserves the legacy tolerant major extraction (NaN on empty)", () => {
    const empty = IrVersion.reconstitute("");
    expect(Number.isNaN(empty.majorVersion())).toBe(true);
    expect(empty.supportsMajor(1)).toBe(false);
    expect(empty.equals(IrVersion.reconstitute(""))).toBe(true);
    expect(empty.equals(IrVersion.reconstitute("1.0.0"))).toBe(false);
  });
});
