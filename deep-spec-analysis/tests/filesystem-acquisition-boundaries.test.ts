import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readArtifactBytes,
  readArtifactStat,
  readArtifactText,
  readDirectory,
} from "@deep-spec-analysis/kernel-adapter";

test("filesystem adapter distinguishes absence from native read failures", () => {
  const root = mkdtempSync(join(tmpdir(), "filesystem-acquisition-"));
  try {
    const directory = join(root, "directory");
    const file = join(root, "file.txt");
    mkdirSync(directory);
    writeFileSync(file, "hello");
    const missing = join(root, "missing.txt");
    const broken = join(file, "nested.txt");

    expect(readArtifactBytes(file).ok).toBe(true);
    expect(readArtifactText(file)).toEqual({ ok: true, value: "hello" });
    expect(readDirectory(directory).ok).toBe(true);
    expect(readArtifactStat(file).ok).toBe(true);

    const absent = readArtifactText(missing);
    expect(absent).toEqual({ ok: false, error: { kind: "not-found", path: missing } });

    const directoryRead = readArtifactText(directory);
    expect(directoryRead.ok).toBe(false);
    if (!directoryRead.ok) {
      expect(directoryRead.error.kind).toBe("io-failed");
      expect(directoryRead.error.path).toBe(directory);
    }

    const brokenDirectoryRead = readDirectory(file);
    expect(brokenDirectoryRead.ok).toBe(false);
    if (!brokenDirectoryRead.ok) {
      expect(brokenDirectoryRead.error.kind).toBe("io-failed");
      expect(brokenDirectoryRead.error.path).toBe(file);
    }

    const brokenStat = readArtifactStat(broken);
    expect(brokenStat).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: "io-failed", path: broken }),
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
