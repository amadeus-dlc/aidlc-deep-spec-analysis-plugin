import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessLiveness } from "@deep-spec-analysis/kernel-adapter";
import { DirectoryFinalizationLock } from "@deep-spec-analysis/kernel-adapter";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import type { Clock } from "@deep-spec-analysis/kernel-usecase";

class FixedClock implements Clock {
  now(): number {
    return 100_000;
  }
}

class FixedLiveness implements ProcessLiveness {
  self(): number {
    return 1;
  }

  statusOf(): "alive" {
    return "alive";
  }
}

test.each(["metadata-directory", "lock-file"] as const)("owner metadata %s failure remains lock-contended", (shape) => {
  const root = mkdtempSync(join(tmpdir(), "lock-metadata-"));
  const directory = join(root, "verify");
  const canonical = join(directory, ".test-lock");
  mkdirSync(directory);
  if (shape === "metadata-directory") {
    mkdirSync(canonical);
    mkdirSync(join(canonical, "owner.lockmeta"));
  } else {
    writeFileSync(canonical, "lock-file");
  }
  try {
    const outcome = new DirectoryFinalizationLock(new FixedClock(), new FixedLiveness(), ".test-lock").acquire(
      ArtifactPath.of(directory),
    );
    expect(outcome.kind).toBe("lock-contended");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
