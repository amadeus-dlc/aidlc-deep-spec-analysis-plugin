import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DoctorPresenter, HarnessFileClientImplementation } from "@deep-spec-analysis/doctor-adapter";
import { ManifestEntry } from "@deep-spec-analysis/doctor-domain";
import { CheckInstallationUseCase } from "@deep-spec-analysis/doctor-usecase";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";

test("harness manifest acquisition distinguishes files, directories, absence, and ENOTDIR", () => {
  const root = mkdtempSync(join(tmpdir(), "harness-file-acquisition-"));
  try {
    const client = new HarnessFileClientImplementation({ root });
    const file = join(root, "tools", "doctor.ts");
    mkdirSync(join(root, "tools"), { recursive: true });
    writeFileSync(file, "file");
    writeFileSync(join(root, "directory-entry"), "directory placeholder");
    mkdirSync(join(root, "directory"));
    writeFileSync(join(root, "blocked"), "file");

    const installed = client.isInstalled(ManifestEntry.error(ArtifactPath.of("tools/doctor.ts")));
    const directory = client.isInstalled(ManifestEntry.error(ArtifactPath.of("directory")));
    const absent = client.isInstalled(ManifestEntry.error(ArtifactPath.of("missing")));
    const blocked = client.isInstalled(ManifestEntry.error(ArtifactPath.of("blocked/child")));

    expect(installed).toEqual({ ok: true, value: true });
    expect(directory).toEqual({ ok: true, value: false });
    expect(absent).toEqual({ ok: true, value: false });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.kind).toBe("io-failed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installation presenter exposes harness acquisition failures instead of missing rows", () => {
  const result = new CheckInstallationUseCase({
    isInstalled: () => ({
      ok: false,
      error: { kind: "io-failed", operation: "read", path: "/workspace/.claude", cause: "EACCES" },
    }),
  }).execute();
  const rows = new DoctorPresenter({ harnessDir: ".claude" }).installation(result);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.passes()).toBe(false);
  expect(rows[0]?.severity().asString()).toBe("error");
  expect(rows[0]?.label()).toContain("installation manifest unavailable");
  expect(rows[0]?.label()).toContain("io-failed");
});
