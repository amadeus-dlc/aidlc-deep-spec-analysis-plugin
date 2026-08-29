// ReferenceCheckReport 集約と Repository の契約テスト（DDD 移行 PR2b、#15）。
//
// compose の 3 経路（適合・自己検証降格・スキーマ不可読降格）は unavailable
// 文言が golden バイトに載るため逐語で固定する。Repository は save→findById の
// 往復同一性（書かれた真実の再構成）と、不在・破損の RepositoryError 変種を
// 契約として検証する。

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "../tools/kernel/adapter/index.ts";
import { err } from "../tools/kernel/domain/index.ts";
import { ReferenceCheckReportRepositoryImpl } from "../tools/refcheck/adapter/index.ts";
import { type Finding, ReferenceCheckReport, ReferenceCheckReportId } from "../tools/refcheck/domain/index.ts";

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)), "..", "tools", "data", "deep-spec-findings-schema.json",
);
const schema = readContractSchema(schemaPath);

function seed(directory: string, overrides: Partial<Parameters<typeof ReferenceCheckReport.compose>[0]> = {}) {
  return ReferenceCheckReport.compose({
    id: ReferenceCheckReportId.of(directory, "components"),
    inputs: [{ artifact: "inception/domain-design/components.md", sha256: "a".repeat(64) }],
    checked: ["check:DD-0"],
    findings: [],
    skipped: [],
    findingsSchema: schema,
    ...overrides,
  });
}

describe("ReferenceCheckReportId", () => {
  test("equality is by directory and backend; boundaries derive the file identity", () => {
    const a = ReferenceCheckReportId.of("/tmp/x", "components");
    expect(a.equals(ReferenceCheckReportId.of("/tmp/x", "components"))).toBe(true);
    expect(a.equals(ReferenceCheckReportId.of("/tmp/y", "components"))).toBe(false);
    expect(a.equals(ReferenceCheckReportId.of("/tmp/x", "functional-design"))).toBe(false);
    expect(a.fileName()).toBe("components.json");
    expect(a.backendName()).toBe("components");
  });
});

describe("ReferenceCheckReport.compose", () => {
  test("a conforming seed passes and renders the canonical document", () => {
    const report = seed("/tmp/r");
    expect(report.passes()).toBe(true);
    expect(report.isUnavailable()).toBe(false);
    expect(report.findingsCount()).toBe(0);
    expect(report.skippedCount()).toBe(0);
    expect(report.id().backendName()).toBe("components");
    const doc = JSON.parse(report.renderBytes());
    expect(Object.keys(doc)).toEqual(["backend", "irVersion", "irHash", "method", "inputs", "checked", "findings", "skipped"]);
    expect(doc.method).toBe("static");
  });

  test("a non-conforming document degrades to unavailable with the frozen wording", () => {
    const badFinding = { kind: "no-such-kind", frRefs: [], targets: ["check:DD-0"], witness: { refs: [] }, detail: "DD-0: x" } as Finding;
    const report = seed("/tmp/r", { findings: [badFinding] });
    expect(report.isUnavailable()).toBe(true);
    expect(report.passes()).toBe(false);
    expect(report.findingsCount()).toBe(0);
    const doc = JSON.parse(report.renderBytes());
    expect(doc.unavailable.reason).toStartWith("self-validation against deep-spec-findings-schema.json failed: ");
  });

  test("an unreadable schema degrades with the frozen wording carrying the cause", () => {
    const report = seed("/tmp/r", { findingsSchema: err({ cause: "boom" }) });
    expect(report.isUnavailable()).toBe(true);
    expect(JSON.parse(report.renderBytes()).unavailable.reason).toBe("findings schema unreadable: boom");
  });
});

describe("ReferenceCheckReportRepository contract (real Impl over a tmpdir)", () => {
  test("save then findById reconstitutes the identical written truth", () => {
    const dir = mkdtempSync(join(tmpdir(), "refcheck-repo-"));
    try {
      const repository = new ReferenceCheckReportRepositoryImpl();
      const report = seed(dir);
      const saved = repository.save(report);
      expect(saved.ok).toBe(true);
      const found = repository.findById(report.id());
      expect(found.ok && found.value.renderBytes()).toBe(report.renderBytes());
      expect(found.ok && found.value.id().equals(report.id())).toBe(true);
      expect(found.ok && found.value.passes()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("findById on an absent id is a not-found error, and corrupt bytes are a corrupt error", () => {
    const dir = mkdtempSync(join(tmpdir(), "refcheck-repo-"));
    try {
      const repository = new ReferenceCheckReportRepositoryImpl();
      const absent = repository.findById(ReferenceCheckReportId.of(dir, "components"));
      expect(!absent.ok && absent.error.kind).toBe("not-found");
      writeFileSync(join(dir, "components.json"), "not json at all");
      const corrupt = repository.findById(ReferenceCheckReportId.of(dir, "components"));
      expect(!corrupt.ok && corrupt.error.kind).toBe("corrupt");
      writeFileSync(join(dir, "components.json"), JSON.stringify({ backend: "other", findings: [], skipped: [] }));
      const mismatched = repository.findById(ReferenceCheckReportId.of(dir, "components"));
      expect(!mismatched.ok && mismatched.error.kind).toBe("corrupt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
