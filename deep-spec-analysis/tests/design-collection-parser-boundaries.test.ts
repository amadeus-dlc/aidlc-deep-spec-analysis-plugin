import { expect, test } from "bun:test";
import {
  parseDesignEntities,
  parseDesignModel,
  parseSiblingDesignReportDocument,
} from "@deep-spec-analysis/design-adapter";
import { ArtifactPath, ContentHash } from "@deep-spec-analysis/kernel-domain";

test("設計属性の件数超過はコレクションparseのエラーとして境界へ返る", () => {
  const result = parseDesignEntities({
    entities: [
      {
        name: "Account",
        attributes: Array.from({ length: 65_537 }, (_, index) => ({ name: `a${index}`, type: { kind: "bool" } })),
      },
    ],
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.kind).toBe("too-many-design-attribute-declarations");
    expect(result.error).not.toBeInstanceOf(Error);
  }
});

test("設計機械の遷移数超過はモデル解析の失敗となりpanicしない", () => {
  const result = parseDesignModel({
    irKind: "design",
    irVersion: "1.0.0",
    units: [
      {
        unit: "u1",
        schema: { entities: [] },
        obligations: [],
        scenarios: [],
        background: [],
        stateMachines: [
          {
            id: "SM-1",
            entity: "Account",
            attribute: "status",
            initial: ["open"],
            ignores: [],
            transitions: Array.from({ length: 65_537 }, (_, index) => ({
              id: `TR-${index + 1}`,
              from: "open",
              to: "closed",
              trigger: "close",
              brRefs: [],
            })),
          },
        ],
      },
    ],
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("too-many-design-transitions");
});

test("兄弟設計レポートの診断数超過は読取エラーとして返る", () => {
  const result = parseSiblingDesignReportDocument(ArtifactPath.of("verify"), "smt.json", {
    irVersion: "1.0.0",
    irHash: ContentHash.ofText("model").asString(),
    backend: "smt",
    method: "bounded",
    findings: Array.from({ length: 65_537 }, () => ({
      kind: "conflict",
      unit: "u1",
      frRefs: [],
      targets: ["DOB-1"],
      witness: {},
      detail: "conflict",
    })),
    skipped: [],
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("too-many-design-findings");
});
