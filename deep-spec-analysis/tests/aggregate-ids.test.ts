// 集約 ID と ArtifactPath の DP 検査（Repository 裁定・補遺の証人）。
// parse は境界の唯一の構築口、ID は of/ofModel が唯一の構築口で、
// equals は値による恒等比較。domain 90% 床のための分岐網羅。

import { describe, expect, test } from "bun:test";
import { ArtifactPath } from "../tools/kernel/domain/index.ts";
import { DesignModelId, RefinementContextId } from "../tools/design/domain/index.ts";
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

  test("RefinementContextId is anchored 1:1 to its design model", () => {
    const model = DesignModelId.of(ap("/r/design.md"));
    const id = RefinementContextId.ofModel(model);
    expect(id.modelArtifactPath().value()).toBe("/r/design.md");
    expect(id.equals(RefinementContextId.ofModel(model))).toBe(true);
    expect(id.equals(RefinementContextId.ofModel(DesignModelId.of(ap("/r/other.md"))))).toBe(false);
  });

  test("DesignRecordId", () => {
    const id = DesignRecordId.of(ap("/r/components.md"));
    expect(id.artifactPath().value()).toBe("/r/components.md");
    expect(id.equals(DesignRecordId.of(ap("/r/components.md")))).toBe(true);
    expect(id.equals(DesignRecordId.of(ap("/r/contract-summary.md")))).toBe(false);
  });
});
