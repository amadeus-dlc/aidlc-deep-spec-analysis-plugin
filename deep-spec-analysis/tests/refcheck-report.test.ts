// ReferenceCheckReport 集約・serializer・Repository の契約テスト（PR2b、#15）。
//
// ドメインは型付き語彙のみ（Json 追放後）。直列化・契約適合・降格文言は
// adapter の serializer が持ち、文言は golden バイトに載るため逐語で固定する。
// Repository は save→findById の往復（書かれた真実の再構成→再描画のバイト
// 同一）と、不在・破損の RepositoryError 変種を契約として検証する。

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "../tools/kernel/adapter/index.ts";
import { ContentHash, ArtifactPath } from "../tools/kernel/domain/index.ts";
// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import { err } from "../tools/kernel/infrastructure/index.ts";
import {
  ReferenceCheckReportRepositoryImpl,
  conformToContract,
  renderReportBytes,
} from "../tools/refcheck/adapter/index.ts";
import { FrRefs, TargetIds } from "../tools/kernel/domain/index.ts";
import {
  CheckFamilies,
  CheckFamily,
  Finding,
  InputAnchor,
  type Skipped,
  Findings,
  InputAnchors,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  Skips,
  UnitName,
  WitnessRefs,
} from "../tools/refcheck/domain/index.ts";

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)), "..", "tools", "data", "deep-spec-findings-schema.json",
);
const schema = readContractSchema(schemaPath);

// 書かれた真実の形で組む（serializer／Repository の契約はこの面を検証する）。
function seed(
  directory: string,
  overrides: { inputs?: InputAnchor[]; checked?: string[]; findings?: Finding[]; skipped?: Skipped[] } = {},
) {
  return ReferenceCheckReport.reconstitute({
    id: ReferenceCheckReportId.of(ap(directory), "components"),
    inputs: InputAnchors.of(
      overrides.inputs ?? [InputAnchor.reconstitute({ artifact: "inception/domain-design/components.md", sha256: ContentHash.reconstitute("a".repeat(64)) })],
    ),
    checked: TargetIds.reconstitute(overrides.checked ?? ["check:DD-0"]),
    findings: Findings.of(overrides.findings ?? []),
    skipped: Skips.of(overrides.skipped ?? []),
    unavailableReason: null,
  });
}

function anchor(artifact: string, fill: string): InputAnchor {
  return InputAnchor.reconstitute({ artifact, sha256: ContentHash.reconstitute(fill.repeat(64)) });
}

describe("ReferenceCheckReportId", () => {
  test("equality is by directory and backend; boundaries derive the file identity", () => {
    const a = ReferenceCheckReportId.of(ap("/tmp/x"), "components");
    expect(a.equals(ReferenceCheckReportId.of(ap("/tmp/x"), "components"))).toBe(true);
    expect(a.equals(ReferenceCheckReportId.of(ap("/tmp/y"), "components"))).toBe(false);
    expect(a.equals(ReferenceCheckReportId.of(ap("/tmp/x"), "functional-design"))).toBe(false);
    expect(a.fileName()).toBe("components.json");
    expect(a.backendName().asString()).toBe("components");
  });
});

describe("ReferenceCheckReport (domain, no serialization knowledge)", () => {
  test("open starts with every family checked, in canonical order, and answers the verdict queries", () => {
    const report = ReferenceCheckReport.open(
      ReferenceCheckReportId.of(ap("/tmp/r"), "components"),
      CheckFamilies.reconstitute(["DD-1", "DD-0", "DD-1"]),
    );
    report.input(anchor("b.md", "b"));
    report.input(anchor("a.md", "a"));
    expect(report.passes()).toBe(true);
    expect(report.isUnavailable()).toBe(false);
    expect(report.findingsCount()).toBe(0);
    expect(report.skippedCount()).toBe(0);
    expect(report.checked().toStrings()).toEqual(["check:DD-0", "check:DD-1"]);
    expect(report.inputs().toArray().map((i) => i.artifact())).toEqual(["a.md", "b.md"]);
    expect(report.unavailableReason()).toBe(null);
    expect(report.id().backendName().asString()).toBe("components");
  });

  test("finding and skip remove their family from checked and render the frozen family prefixes", () => {
    const report = ReferenceCheckReport.open(
      ReferenceCheckReportId.of(ap("/tmp/r"), "functional-design"),
      CheckFamilies.reconstitute(["A-1", "A-2", "A-3"]),
      UnitName.reconstitute("u9"),
    );
    report.finding(CheckFamily.reconstitute("A-1"), "structure-invalid", ["check:A-1"], [], "boom");
    report.skip(CheckFamily.reconstitute("A-2"), "absent-input", "gone");
    expect(report.findings().toArray()[0]?.detail()).toBe("A-1: boom");
    expect(report.findings().toArray()[0]?.unit()).toBe("u9");
    expect(report.findings().toArray()[0]?.targets().toStrings()).toEqual(["check:A-1"]);
    expect(report.skipped().toArray()[0]?.target()).toBe("check:A-2");
    expect(report.skipped().toArray()[0]?.reason()).toBe("absent-input");
    expect(report.skipped().toArray()[0]?.unit()).toBe("u9");
    expect(report.checked().toStrings()).toEqual(["check:A-3"]);
    expect(report.passes()).toBe(false);
    expect(report.findingsCount()).toBe(1);
    expect(report.skippedCount()).toBe(1);
  });

  test("a family failing twice leaves checked once; findings and skips keep the canonical order as they arrive", () => {
    const report = ReferenceCheckReport.open(
      ReferenceCheckReportId.of(ap("/tmp/r"), "components"),
      CheckFamilies.reconstitute(["DD-0", "DD-1", "DD-2"]),
    );
    report.finding(CheckFamily.reconstitute("DD-1"), "reference-broken", ["check:DD-1"], [], "second kind");
    report.finding(CheckFamily.reconstitute("DD-1"), "structure-invalid", ["check:DD-1"], [], "first kind");
    report.finding(CheckFamily.reconstitute("DD-1"), "structure-invalid", ["check:DD-1"], [], "a earlier detail", ["FR-2", "FR-1", "FR-2"]);
    report.skip(CheckFamily.reconstitute("DD-2"), "unrecognized-format", "later");
    report.skip(CheckFamily.reconstitute("DD-0"), "absent-input", "earlier");
    expect(report.findings().toArray().map((f) => f.detail())).toEqual(["DD-1: a earlier detail", "DD-1: first kind", "DD-1: second kind"]);
    expect(report.findings().toArray()[0]?.frRefs().toArray()).toEqual(["FR-1", "FR-2"]);
    expect(report.findings().toArray()[0]?.unit()).toBe(undefined);
    expect(report.skipped().toArray().map((s) => s.target())).toEqual(["check:DD-0", "check:DD-2"]);
    expect(report.checked().toStrings()).toEqual([]);
  });

  test("degraded keeps the inputs, empties the content, and fails the verdict", () => {
    const degraded = seed("/tmp/r").degraded("why");
    expect(degraded.isUnavailable()).toBe(true);
    expect(degraded.passes()).toBe(false);
    expect(degraded.unavailableReason()).toBe("why");
    expect(degraded.checked().toStrings()).toEqual([]);
    expect(degraded.findingsCount()).toBe(0);
    expect(degraded.inputs().toArray()).toHaveLength(1);
  });
});

describe("serializer (adapter owns the format knowledge)", () => {
  test("a conforming report renders the canonical document and survives conformance untouched", () => {
    const report = seed("/tmp/r");
    expect(conformToContract(report, schema)).toBe(report);
    const doc = JSON.parse(renderReportBytes(report));
    expect(Object.keys(doc)).toEqual(["backend", "irVersion", "irHash", "method", "inputs", "checked", "findings", "skipped"]);
    expect(doc.method).toBe("static");
    expect(doc.irHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a non-conforming document degrades with the frozen wording", () => {
    const badFinding: Finding = Finding.reconstitute({ kind: "no-such-kind", frRefs: FrRefs.of([]), targets: TargetIds.reconstitute(["check:DD-0"]), witness: { refs: WitnessRefs.of([]) }, detail: "DD-0: x" });
    const conformed = conformToContract(seed("/tmp/r", { findings: [badFinding] }), schema);
    expect(conformed.isUnavailable()).toBe(true);
    expect(conformed.unavailableReason()).toStartWith("self-validation against deep-spec-findings-schema.json failed: ");
    expect(JSON.parse(renderReportBytes(conformed)).unavailable.reason).toStartWith("self-validation against ");
  });

  test("an unreadable schema degrades with the frozen wording carrying the cause", () => {
    const conformed = conformToContract(seed("/tmp/r"), err({ cause: "boom" }));
    expect(conformed.unavailableReason()).toBe("findings schema unreadable: boom");
  });
});

describe("ReferenceCheckReportRepository contract (real Impl over a tmpdir)", () => {
  test("store then findById reconstitutes the written truth byte-for-byte", () => {
    const dir = mkdtempSync(join(tmpdir(), "refcheck-repo-"));
    try {
      const repository = new ReferenceCheckReportRepositoryImpl(schemaPath);
      const report = seed(dir);
      expect(repository.store(report).ok).toBe(true);
      const found = repository.findById(report.id());
      expect(found.ok && renderReportBytes(found.value)).toBe(renderReportBytes(report));
      expect(found.ok && found.value.id().equals(report.id())).toBe(true);
      expect(found.ok && found.value.passes()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("findById on an absent id is a not-found error, and corrupt bytes are a corrupt error", () => {
    const dir = mkdtempSync(join(tmpdir(), "refcheck-repo-"));
    try {
      const repository = new ReferenceCheckReportRepositoryImpl(schemaPath);
      const absent = repository.findById(ReferenceCheckReportId.of(ap(dir), "components"));
      expect(!absent.ok && absent.error.kind).toBe("not-found");
      writeFileSync(join(dir, "components.json"), "not json at all");
      const corrupt = repository.findById(ReferenceCheckReportId.of(ap(dir), "components"));
      expect(!corrupt.ok && corrupt.error.kind).toBe("corrupt");
      writeFileSync(join(dir, "components.json"), JSON.stringify({ backend: "other", inputs: [], checked: [], findings: [], skipped: [] }));
      const mismatched = repository.findById(ReferenceCheckReportId.of(ap(dir), "components"));
      expect(!mismatched.ok && mismatched.error.kind).toBe("corrupt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
