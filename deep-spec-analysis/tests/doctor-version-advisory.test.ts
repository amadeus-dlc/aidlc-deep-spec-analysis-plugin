import { afterEach, describe, expect, test } from "bun:test";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DoctorPresenter,
  GitHubReleaseTagsClientImplementation,
  InstallationProvenanceClientImplementation,
} from "@deep-spec/doctor-adapter";
import {
  CheckSeverity,
  HealthVerdict,
  InstallationProvenance,
  InstallationSource,
  InstalledRelease,
  InstalledStatus,
  ManifestEntry,
  PluginVersion,
  ReleaseCatalog,
  SolverAvailability,
  StableReleases,
} from "@deep-spec/doctor-domain";
import {
  CheckVersionAdvisoryUseCase,
  type InstallationProvenanceClient,
  type ReleaseTagsClient,
} from "@deep-spec/doctor-usecase";
import { ArtifactPath, ErrorMessage } from "@deep-spec/kernel-domain";
import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";

class FixedProvenanceClient implements InstallationProvenanceClient {
  readonly #result: InstallationProvenance;

  constructor(result: InstallationProvenance) {
    this.#result = result;
  }

  read(): InstallationProvenance {
    return this.#result;
  }
}

class FixedReleaseTagsClient implements ReleaseTagsClient {
  readonly #result: ReleaseCatalog;
  calls = 0;

  constructor(result: ReleaseCatalog) {
    this.#result = result;
  }

  async list(): Promise<ReleaseCatalog> {
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

const installedRelease = (version = "0.5.0") =>
  InstalledRelease.of(PluginVersion.of(version), InstallationSource.of("latest"), ArtifactPath.of("v0.5.0"));
const provenance = (version = "0.5.0"): InstallationProvenance =>
  InstallationProvenance.installed(installedRelease(version));
const available = (tags: readonly string[]) =>
  ReleaseCatalog.available(
    StableReleases.of(
      tags.flatMap((tag) => {
        const version = PluginVersion.parse(tag);
        return version.ok ? [version.value] : [];
      }),
    ),
  );

const check = async (provenanceRead: InstallationProvenance, tagsRead: ReleaseCatalog) => {
  const advisory = await new CheckVersionAdvisoryUseCase(
    new FixedProvenanceClient(provenanceRead),
    new FixedReleaseTagsClient(tagsRead),
  ).execute();
  return new DoctorPresenter({ harnessDir: ".claude" }).version(advisory);
};

describe("doctor version advisory", () => {
  test("新しい stable tag を検出し、advisory の更新方法を示す", async () => {
    const row = await check(provenance(), available(["v0.4.9", "v0.6.0-rc.1", "not-a-version", "v0.6.0"]));

    expect(row.toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: update available — version 0.5.0 from latest v0.5.0; latest stable tag is v0.6.0",
      fix: "Re-run the installer with `--project . --update` (and the same `--harness` selector used for this installation).",
      severity: "advisory",
    });
  });

  test("導入版が最新または先行していれば current と判定する", async () => {
    const latest = await check(provenance(), available(["v0.5.0", "v0.5.0-beta.1"]));
    expect(latest.toDocument()).toEqual({
      pass: true,
      label: "deep-spec-analysis: version 0.5.0 from latest v0.5.0 is current (latest stable tag: v0.5.0)",
      severity: "advisory",
    });

    const ahead = await check(provenance("0.6.0"), available(["v0.5.0"]));
    expect(ahead.passes()).toBe(true);
  });

  test("来歴欠落と malformed を修復可能な advisory 値として返し、GitHub を呼ばない", async () => {
    const missingRoot = temporaryHarness();
    const missingTags = new FixedReleaseTagsClient(available(["v9.9.9"]));
    const missing = await new CheckVersionAdvisoryUseCase(
      new InstallationProvenanceClientImplementation({ harnessRoot: missingRoot }),
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
    const malformedTags = new FixedReleaseTagsClient(available(["v9.9.9"]));
    const malformed = await new CheckVersionAdvisoryUseCase(
      new InstallationProvenanceClientImplementation({ harnessRoot: malformedRoot }),
      malformedTags,
    ).execute();
    expect(presenter.version(malformed).toDocument()).toEqual({
      pass: false,
      label:
        "deep-spec-analysis: version update check unavailable — installation provenance is malformed (file is not readable JSON)",
      fix: "Re-run the installer normally (without `--update`) to replace .claude/tools/data/deep-spec-analysis-install.json.",
      severity: "advisory",
    });
    expect(malformedTags.calls).toBe(0);
  });

  test("GitHub 不達は pass=true の advisory とし、label に skip 理由を残す", async () => {
    const row = await check(provenance(), ReleaseCatalog.unavailable(ErrorMessage.of("network is offline")));

    expect(row.toDocument()).toEqual({
      pass: true,
      label: "deep-spec-analysis: version update check skipped for 0.5.0 from latest v0.5.0 — network is offline",
      severity: "advisory",
    });
  });

  test("GitHub adapter はレスポンスを値へ変換し、HTTP failure も unavailable 値で返す", async () => {
    const available = new GitHubReleaseTagsClientImplementation({
      repository: "example/repository",
      fetcher: async () => new Response(JSON.stringify([{ name: "v0.5.0" }, { name: "development" }]), { status: 200 }),
    });
    expect(
      new DoctorPresenter({ harnessDir: ".claude" })
        .version((await available.list()).advise(installedRelease()))
        .label(),
    ).toContain("is current (latest stable tag: v0.5.0)");

    const unavailable = new GitHubReleaseTagsClientImplementation({
      repository: "example/repository",
      fetcher: async () => new Response("rate limited", { status: 503 }),
    });
    expect(
      new DoctorPresenter({ harnessDir: ".claude" })
        .version((await unavailable.list()).advise(installedRelease()))
        .label(),
    ).toContain("GitHub tags API returned HTTP 503");
  });

  test("version 行は installation の直後、solver の直前で、公開 JSON に新 field を増やさない", async () => {
    const presenter = new DoctorPresenter({ harnessDir: ".claude" });
    const version = await new CheckVersionAdvisoryUseCase(
      new FixedProvenanceClient(provenance()),
      new FixedReleaseTagsClient(available(["v0.5.0"])),
    ).execute();
    const verdict = HealthVerdict.of([
      ...presenter.installation([
        InstalledStatus.of(ManifestEntry.error(ArtifactPath.of("tools/deep-spec-analysis-doctor.ts")), true),
      ]),
      presenter.version(version),
      ...presenter.solvers(
        SolverAvailability.of({
          z3Package: true,
          nodeRuntime: true,
          quintCli: true,
          apalache: true,
          apalacheServerStale: false,
        }),
      ),
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

describe("typed release observations", () => {
  test("empty stable catalogue is an explicit skip and prerelease tags are not candidates", async () => {
    const row = await check(provenance(), available(["development", "v1.0.0-rc.1"]));
    expect(row.passes()).toBe(true);
    expect(row.label()).toContain("GitHub returned no stable Semantic Versioning tag");
  });

  test("stable collection enforces count budget, owns its input, and selects the latest version", () => {
    const versions = [PluginVersion.of("1.0.0"), PluginVersion.of("2.0.0"), PluginVersion.of("0.2.0")];
    const releases = StableReleases.of(versions);
    versions.length = 0;
    const row = new DoctorPresenter({ harnessDir: ".claude" }).version(releases.advise(installedRelease()));
    expect(row.label()).toContain("latest stable tag is v2.0.0");
    expect(StableReleases.parse([PluginVersion.of("1.0.0")]).ok).toBe(true);
    expect(StableReleases.parse(Array(10_000).fill(PluginVersion.of("1.0.0"))).ok).toBe(true);
    expect(() => StableReleases.of(Array(10_001).fill(PluginVersion.of("1.0.0")))).toThrow(IllegalArgumentException);
    const parsed = StableReleases.parse(Array(10_001).fill(PluginVersion.of("1.0.0")));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  });

  test("installation source is a bounded closed vocabulary with panic/Result factories", () => {
    for (const value of ["local", "ref", "tag", "latest"]) {
      expect(InstallationSource.of(value).asString()).toBe(value);
      expect(InstallationSource.parse(value).ok).toBe(true);
    }
    for (const value of ["", "x".repeat(7), "Latest", "other", "tag\n"]) {
      expect(() => InstallationSource.of(value)).toThrow(IllegalArgumentException);
      const parsed = InstallationSource.parse(value);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
    }
  });

  test("provenance adapter parses valid release fields before external lookup and rejects malformed versions", async () => {
    const root = temporaryHarness();
    const path = join(root, "tools", "data");
    mkdirSync(path, { recursive: true });
    const base = {
      version: "0.5.0",
      ref: "v0.5.0",
      source: "latest",
      installed_at: "2026-09-05T00:00:00Z",
      payload_sha256: `sha256:${"a".repeat(64)}`,
    };
    const write = (value: object) =>
      writeFileSync(join(path, "deep-spec-analysis-install.json"), JSON.stringify(value));
    const tags = new FixedReleaseTagsClient(available(["v0.5.0"]));
    const usecase = new CheckVersionAdvisoryUseCase(
      new InstallationProvenanceClientImplementation({ harnessRoot: root }),
      tags,
    );
    const presenter = new DoctorPresenter({ harnessDir: ".claude" });
    write(base);
    expect(presenter.version(await usecase.execute()).label()).toContain("is current");
    expect(tags.calls).toBe(1);
    for (const invalid of [
      { ...base, version: "0.5.0-beta.1" },
      { ...base, ref: "a".repeat(4097) },
      { ...base, source: "unknown" },
      { ...base, payload_sha256: "invalid" },
    ]) {
      write(invalid);
      expect(presenter.version(await usecase.execute()).label()).toContain("provenance is malformed");
    }
    expect(tags.calls).toBe(1);
    write({ ...base, source: "unknown", version: "0.5.0-beta.1" });
    expect(presenter.version(await usecase.execute()).label()).toContain("required provenance fields are invalid");
    write({ ...base, source: "latest", version: "0.5.0-beta.1" });
    expect(presenter.version(await usecase.execute()).label()).toContain("version is not a stable Semantic Version");
    expect(tags.calls).toBe(1);
    write([]);
    expect(presenter.version(await usecase.execute()).label()).toContain("document must be an object");
  });

  test("release adapter handles network and document failures without constructing unchecked versions", async () => {
    const presenter = new DoctorPresenter({ harnessDir: ".claude" });
    for (const fetcher of [
      async () => {
        throw new Error("offline\nretry later");
      },
      async () => new Response("{}"),
      async () => new Response("{broken"),
      async () => new Response(JSON.stringify(Array(101).fill({ name: "v1.0.0" }))),
      async () => new Response(JSON.stringify(Array(100).fill({ name: "v1.0.0" }))),
    ]) {
      const client = new GitHubReleaseTagsClientImplementation({ repository: "example/repository", fetcher });
      expect(presenter.version((await client.list()).advise(installedRelease())).label()).toContain(
        "version update check skipped",
      );
    }
  });
});
