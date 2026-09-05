
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { CheckSeverity, HealthVerdict, InstalledStatus, ManifestEntry, PluginVersion, SolverAvailability } from "@deep-spec/doctor-domain";
import {
  CheckVersionAdvisoryUseCase,
  type InstallationProvenanceClient,
  type InstallationProvenanceRead,
  type ReleaseTagsClient,
  type ReleaseTagsRead,
} from "@deep-spec/doctor-usecase";
import { DoctorPresenter, GitHubReleaseTagsClientImpl, InstallationProvenanceClientImpl } from "@deep-spec/doctor-adapter";

class FixedProvenanceClient implements InstallationProvenanceClient {
  readonly #result: InstallationProvenanceRead;

  constructor(result: InstallationProvenanceRead) {
    this.#result = result;
  }

  read(): InstallationProvenanceRead {
    return this.#result;
  }
}

class FixedReleaseTagsClient implements ReleaseTagsClient {
  readonly #result: ReleaseTagsRead;
  calls = 0;

  constructor(result: ReleaseTagsRead) {
    this.#result = result;
  }

  async list(): Promise<ReleaseTagsRead> {
    this.calls += 1;
    return this.#result;
  }
}

const roots: string[] = [];
const temporaryHarness = (): string => {
  const root = mkdtempSync(join(tmpdir(), "doctor-version-advisory-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const provenance = (version = "0.5.0"): InstallationProvenanceRead => ({
  kind: "found",
  version,
  ref: "v0.5.0",
  source: "latest",
});

const check = async (
  provenanceRead: InstallationProvenanceRead,
  tagsRead: ReleaseTagsRead,
) => {
  const advisory = await new CheckVersionAdvisoryUseCase(
    new FixedProvenanceClient(provenanceRead),
    new FixedReleaseTagsClient(tagsRead),
  ).execute();
  return new DoctorPresenter({ harnessDir: ".claude" }).version(advisory);
};

describe("doctor version advisory", () => {
  test("新しい stable tag を検出し、advisory の更新方法を示す", async () => {
    const row = await check(provenance(), {
      kind: "available",
      tags: ["v0.4.9", "v0.6.0-rc.1", "not-a-version", "v0.6.0"],
    });

    expect(row.toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: update available — version 0.5.0 from latest v0.5.0; latest stable tag is v0.6.0",
      fix: "Re-run the installer with `--project . --update` (and the same `--harness` selector used for this installation).",
      severity: "advisory",
    });
  });

  test("導入版が最新または先行していれば current と判定する", async () => {
    const latest = await check(provenance(), { kind: "available", tags: ["v0.5.0", "v0.5.0-beta.1"] });
    expect(latest.toDocument()).toEqual({
      pass: true,
      label: "deep-spec-analysis: version 0.5.0 from latest v0.5.0 is current (latest stable tag: v0.5.0)",
      severity: "advisory",
    });

    const ahead = await check(provenance("0.6.0"), { kind: "available", tags: ["v0.5.0"] });
    expect(ahead.passes()).toBe(true);
  });

  test("来歴欠落と malformed を修復可能な advisory 値として返し、GitHub を呼ばない", async () => {
    const missingRoot = temporaryHarness();
    const missingTags = new FixedReleaseTagsClient({ kind: "available", tags: ["v9.9.9"] });
    const missing = await new CheckVersionAdvisoryUseCase(
      new InstallationProvenanceClientImpl({ harnessRoot: missingRoot }),
      missingTags,
    ).execute();
    const presenter = new DoctorPresenter({ harnessDir: ".claude" });
    expect(presenter.version(missing).toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: version update check unavailable — installation provenance is missing",
      fix: "Re-run the installer normally (without `--update`) to create .claude/tools/data/deep-spec-analysis-install.json.",
      severity: "advisory",
    });
    expect(missingTags.calls).toBe(0);

    const malformedRoot = temporaryHarness();
    const dataDir = join(malformedRoot, "tools", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "deep-spec-analysis-install.json"), "{not-json\n");
    const malformedTags = new FixedReleaseTagsClient({ kind: "available", tags: ["v9.9.9"] });
    const malformed = await new CheckVersionAdvisoryUseCase(
      new InstallationProvenanceClientImpl({ harnessRoot: malformedRoot }),
      malformedTags,
    ).execute();
    expect(presenter.version(malformed).toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: version update check unavailable — installation provenance is malformed (file is not readable JSON)",
      fix: "Re-run the installer normally (without `--update`) to replace .claude/tools/data/deep-spec-analysis-install.json.",
      severity: "advisory",
    });
    expect(malformedTags.calls).toBe(0);
  });

  test("GitHub 不達は pass=true の advisory とし、label に skip 理由を残す", async () => {
    const row = await check(provenance(), { kind: "unavailable", reason: "network is offline" });

    expect(row.toDocument()).toEqual({
      pass: true,
      label: "deep-spec-analysis: version update check skipped for 0.5.0 from latest v0.5.0 — network is offline",
      severity: "advisory",
    });
  });

  test("GitHub adapter はレスポンスを値へ変換し、HTTP failure も unavailable 値で返す", async () => {
    const available = new GitHubReleaseTagsClientImpl({
      repository: "example/repository",
      fetcher: async () => new Response(JSON.stringify([{ name: "v0.5.0" }, { name: "development" }]), { status: 200 }),
    });
    expect(await available.list()).toEqual({ kind: "available", tags: ["v0.5.0", "development"] });

    const unavailable = new GitHubReleaseTagsClientImpl({
      repository: "example/repository",
      fetcher: async () => new Response("rate limited", { status: 503 }),
    });
    expect(await unavailable.list()).toEqual({ kind: "unavailable", reason: "GitHub tags API returned HTTP 503" });
  });

  test("version 行は installation の直後、solver の直前で、公開 JSON に新 field を増やさない", async () => {
    const presenter = new DoctorPresenter({ harnessDir: ".claude" });
    const version = await new CheckVersionAdvisoryUseCase(
      new FixedProvenanceClient(provenance()),
      new FixedReleaseTagsClient({ kind: "available", tags: ["v0.5.0"] }),
    ).execute();
    const verdict = HealthVerdict.of([
      ...presenter.installation([InstalledStatus.of(ManifestEntry.error("tools/deep-spec-analysis-doctor.ts"), true)]),
      presenter.version(version),
      ...presenter.solvers(SolverAvailability.of({ z3Package: true, nodeRuntime: true, quintCli: true, apalache: true, apalacheServerStale: false })),
    ]).document();

    expect(verdict.checks.slice(0, 3).map((row) => row.label)).toEqual([
      "deep-spec-analysis: tools/deep-spec-analysis-doctor.ts installed",
      "deep-spec-analysis: version 0.5.0 from latest v0.5.0 is current (latest stable tag: v0.5.0)",
      "deep-spec-analysis: z3-solver package present (SMT backend)",
    ]);
    for (const row of verdict.checks) {
      expect(Object.keys(row).every((key) => ["pass", "label", "fix", "severity"].includes(key))).toBe(true);
      expect(row.severity === "error" || row.severity === "advisory").toBe(true);
    }
    expect(CheckSeverity.advisory().isAdvisory()).toBe(true);
  });

  test("PluginVersion は stable SemVer だけを受理し、大きな数値も精度を落とさず比較する", () => {
    const current = PluginVersion.of("v999999999999999999999.2.3");
    const latest = PluginVersion.of("999999999999999999999.2.4");
    expect(current?.asString()).toBe("999999999999999999999.2.3");
    expect(current?.asTag()).toBe("v999999999999999999999.2.3");
    expect(current?.isOlderThan(latest)).toBe(true);
    expect(current?.equals(PluginVersion.of("999999999999999999999.2.3"))).toBe(true);
    expect(PluginVersion.parse("01.2.3").ok).toBe(false);
    expect(PluginVersion.parse("1.2.3-beta.1").ok).toBe(false);
  });
});
