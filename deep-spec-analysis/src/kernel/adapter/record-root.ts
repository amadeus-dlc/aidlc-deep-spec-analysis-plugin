// intent record ルートの発見と record 相対パス化。deep-spec-lib.ts からの
// 逐語移動。後続 PR で IntentRecordRepository ポートへ再モデル化予定。

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Ascend from the written artifact's directory to the intent record root —
// the directory that contains the phase directories (inception/…,
// construction/…). Bounded walk; null when no root shape is found.
export function findRecordRoot(startDir: string): string | null {
  let d = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, "inception")) || existsSync(join(d, "aidlc-state.md"))) return d;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

export function relArtifact(recordRoot: string | null, absPath: string): string {
  if (recordRoot && absPath.startsWith(`${recordRoot}/`)) {
    return absPath.slice(recordRoot.length + 1);
  }
  return absPath.split("/").slice(-1)[0] ?? absPath;
}
