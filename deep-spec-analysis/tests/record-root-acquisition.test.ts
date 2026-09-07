import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findRecordRoot } from "@deep-spec-analysis/kernel-adapter";

test("findRecordRoot distinguishes a missing root from an unreadable ancestor", () => {
  const directory = mkdtempSync(join(tmpdir(), "record-root-acquisition-"));
  try {
    const absent = findRecordRoot(join(directory, "construction", "unit", "functional-design"));
    expect(absent).toEqual({ ok: true, value: null });

    const blockingFile = join(directory, "blocked");
    writeFileSync(blockingFile, "file");
    const unreadable = findRecordRoot(join(blockingFile, "unit", "functional-design"));
    expect(unreadable.ok).toBe(false);
    if (!unreadable.ok) {
      expect(unreadable.error.kind).toBe("io-failed");
      expect(unreadable.error.path).toContain("blocked");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
