// パリティハーネス（opt-in）— AIDLC_PARITY=1 のときだけ実行される。
//
// 同一コミットでスナップショットを 2 回取り、ツリー全体（findings バイト・
// verdict 行・exit code）のバイト同一を表明する（実行時決定論）。
// リファクタ前後の比較は儀式側で行う:
//   base worktree で `bun tests/parity/snapshot.ts before/`
//   変更後に        `bun tests/parity/snapshot.ts after/`
//   `diff -r before after` が空であること。

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { snapshotAll } from "./snapshot.ts";

const enabled = process.env.AIDLC_PARITY === "1";

function listFiles(root: string, dir = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listFiles(root, p));
    else out.push(relative(root, p));
  }
  return out;
}

describe("parity harness", () => {
  test.if(enabled)(
    "two snapshots of the same commit are byte-identical across every sensor and scenario",
    () => {
      const first = mkdtempSync(join(tmpdir(), "deep-spec-parity-a-"));
      const second = mkdtempSync(join(tmpdir(), "deep-spec-parity-b-"));
      try {
        snapshotAll(first);
        snapshotAll(second);
        const firstFiles = listFiles(first);
        expect(firstFiles.length).toBeGreaterThan(0);
        expect(listFiles(second)).toEqual(firstFiles);
        for (const rel of firstFiles) {
          expect(readFileSync(join(second, rel), "utf-8")).toBe(readFileSync(join(first, rel), "utf-8"));
        }
      } finally {
        rmSync(first, { recursive: true, force: true });
        rmSync(second, { recursive: true, force: true });
      }
    },
    900_000,
  );

  test.if(!enabled)("parity harness is opt-in (set AIDLC_PARITY=1 to run)", () => {
    expect(enabled).toBe(false);
  });
});
