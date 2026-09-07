import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath, ContentHash } from "@deep-spec-analysis/kernel-domain";
import { parseFormalModel, QuintClientImplementation } from "@deep-spec-analysis/requirements-adapter";
import {
  FormalModelIdentifier,
  RequirementsModel,
  VerificationReportIdentifier,
} from "@deep-spec-analysis/requirements-domain";

function model(): RequirementsModel {
  const parsed = parseFormalModel({
    irVersion: "1.0.0",
    schema: { entities: [{ name: "Account", attributes: [{ name: "active", type: { kind: "bool" } }] }] },
    obligations: [{ id: "OB-1", nature: "invariant", frRefs: [], assert: { op: "ref", path: "Account.active" } }],
    scenarios: [],
    background: [],
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return RequirementsModel.of({
    ...parsed.value,
    id: FormalModelIdentifier.of(ArtifactPath.of("/model")),
    irHash: ContentHash.ofText("model"),
    sourceDocument: new Uint8Array(),
  });
}

function fakeQuint(directory: string): string {
  const path = join(directory, "quint");
  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      'if (process.argv.includes("--version")) { console.log("0.32.0"); process.exit(0); }',
      "process.exit(0);",
      "",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
  return path;
}

const javaProbe = mkdtempSync(join(tmpdir(), "quint-autodetect-java-"));
const home = mkdtempSync(join(tmpdir(), "quint-autodetect-home-"));
const cliDirectory = mkdtempSync(join(tmpdir(), "quint-autodetect-cli-"));
const originalPath = process.env.PATH;

beforeAll(() => {
  symlinkSync(process.execPath, join(javaProbe, "java"));
  process.env.PATH = `${javaProbe}:${originalPath ?? ""}`;
});

afterAll(() => {
  process.env.PATH = originalPath;
  rmSync(javaProbe, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  rmSync(cliDirectory, { recursive: true, force: true });
});

function client(): QuintClientImplementation {
  return new QuintClientImplementation({
    quintBin: fakeQuint(cliDirectory),
    methodOverride: undefined,
    apalacheDistSet: false,
    homeDirectory: home,
  });
}

describe("Quint の Apalache 自動検出", () => {
  test(".quint が存在しない ENOENT は simulation fallback として扱う", () => {
    rmSync(join(home, ".quint"), { recursive: true, force: true });
    const input = model();
    const result = client().check(input);
    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));

    expect(result.match({ checked: () => true, unavailable: () => false, uncompilable: () => false })).toBe(true);
    expect(report.method()).toBe("simulation");
    expect(report.isUnavailable()).toBe(false);
  });

  test(".quint が通常ファイルで読めないときは backend-unavailable と原因を残す", () => {
    writeFileSync(join(home, ".quint"), "not a directory");
    const input = model();
    const result = client().check(input);
    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));
    const reason = report.unavailableReason();

    expect(result.match({ checked: () => false, unavailable: () => true, uncompilable: () => false })).toBe(true);
    expect(report.method()).toBe("simulation");
    expect(report.isUnavailable()).toBe(true);
    expect(reason).toContain("quint backend unavailable:");
    expect(reason).toContain("io-failed:");
    expect(report.skipped().count()).toBe(1);
    expect(
      report
        .skipped()
        .toArray()
        .every((skip) => skip.reason() === "unavailable"),
    ).toBe(true);
    expect(
      report
        .skipped()
        .toArray()
        .every((skip) => skip.detail()?.includes("io-failed")),
    ).toBe(true);
  });

  test("配布物名の通常ファイルは bounded capability と数えず simulation に留める", () => {
    rmSync(join(home, ".quint"), { recursive: true, force: true });
    mkdirSync(join(home, ".quint"), { recursive: true });
    writeFileSync(join(home, ".quint", "apalache-dist-fake"), "not a distribution directory");
    const input = model();
    const result = client().check(input);
    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));

    expect(result.match({ checked: () => true, unavailable: () => false, uncompilable: () => false })).toBe(true);
    expect(report.method()).toBe("simulation");
    expect(report.isUnavailable()).toBe(false);
  });
});
