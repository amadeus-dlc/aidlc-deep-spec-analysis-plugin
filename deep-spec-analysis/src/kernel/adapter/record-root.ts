// intent record ルートの発見と record 相対パス化。

import { dirname, join } from "node:path";
import { err, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import { readArtifactStat } from "./artifact-io.ts";

// Ascend from the written artifact's directory to the intent record root —
// the directory that contains the phase directories (inception/…,
// construction/…). Bounded walk; null when no root shape is found.
export function findRecordRoot(startDir: string): Result<string | null, RepositoryError> {
  let d = startDir;
  for (let i = 0; i < 8; i++) {
    const inception = readArtifactStat(join(d, "inception"));
    if (inception.ok) return ok(d);
    if (inception.error.kind !== "not-found") return err(inception.error);
    const state = readArtifactStat(join(d, "aidlc-state.md"));
    if (state.ok) return ok(d);
    if (state.error.kind !== "not-found") return err(state.error);
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return ok(null);
}

export function relArtifact(recordRoot: string | null, absPath: string): string {
  if (recordRoot && absPath.startsWith(`${recordRoot}/`)) {
    return absPath.slice(recordRoot.length + 1);
  }
  return absPath.split("/").slice(-1)[0] ?? absPath;
}
