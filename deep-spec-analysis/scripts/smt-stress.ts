// SMT witness 決定性のストレス網（#28）——設計 fixture の SMT verify を
// CPU 負荷下で N 回発火し、smt.json バイトが 1 種に収束することを確かめる。
// issue #28 の観測（負荷時に SM-1/TR-3/TR-4 gap witness の ticket.priority が
// golden の 1 から 0 へ揺れた）の再現・回帰網。子 V8 ヒープを絞って GC を
// 頻発させるには NODE_OPTIONS="--max-old-space-size=64" を付けて呼ぶ。
//
// 使い方:  bun scripts/smt-stress.ts [iterations=24] [loadWorkers=cpus-2]
// 終了コード: 要求した全反復が成功し、かつ出力が 1 種のときだけ 0。
// 揺れ・失敗（spawn エラー・timeout・非 0 exit）・観測 0 件は 1
//（silent fake-green の防止——snapshot.ts と同じ規律）。

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const iterations = Number(process.argv[2] ?? 24);
const loadWorkers = Number(process.argv[3] ?? Math.max(2, cpus().length - 2));
const fixtures = join(pluginRoot, "tests", "fixtures");
const tool = join(pluginRoot, "tools", "aidlc-sensor-deep-spec-design-verify-smt.ts");

const hogs = Array.from({ length: loadWorkers }, () =>
  spawn("bun", ["-e", "let x=0; const a=[]; while(true){x=(x*31+1)%1e9; a.push({x}); if(a.length>5e4) a.length=0;}"], { stdio: "ignore" }),
);
const hashes = new Map<string, number>();
const priorities = new Map<string, number>();
let successes = 0;
try {
  for (let i = 0; i < iterations; i++) {
    const record = join(tmpdir(), `smt-stress-${i}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(record, { recursive: true });
    try {
      cpSync(join(fixtures, "design", "record"), record, { recursive: true });
      const model = join(record, "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md");
      const res = spawnSync("bun", [tool, "--stage", "deep-spec-analysis-functional-verify", "--output-path", model], {
        encoding: "utf-8",
        timeout: 240_000,
      });
      if (res.error || res.status !== 0) {
        console.log(`iter ${i}: sensor failed (${res.error ? String(res.error) : `exit ${res.status}`})`);
        continue;
      }
      const smt = readFileSync(join(record, "construction", "deep-spec-analysis-functional-verify", "deep-spec-design-verify", "smt.json"), "utf-8");
      const h = createHash("sha256").update(smt).digest("hex").slice(0, 12);
      hashes.set(h, (hashes.get(h) ?? 0) + 1);
      const doc = JSON.parse(smt) as { findings?: { kind: string; targets: string[]; witness?: { model?: { [k: string]: unknown } } }[] };
      const gap = (doc.findings ?? []).find((f) => f.kind === "completeness-gap" && JSON.stringify(f.targets) === JSON.stringify(["SM-1", "TR-3", "TR-4"]));
      const p = gap ? String(gap.witness?.model?.["ticket.priority"]) : "(no-gap)";
      priorities.set(p, (priorities.get(p) ?? 0) + 1);
      successes += 1;
      process.stdout.write(`iter ${i}: ${h} priority=${p}\n`);
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  }
} finally {
  for (const hog of hogs) hog.kill("SIGKILL");
}
console.log("=== distinct smt.json hashes:", hashes.size, JSON.stringify([...hashes.entries()]));
console.log("=== priority histogram:", JSON.stringify([...priorities.entries()]));
console.log(`=== successes: ${successes}/${iterations}`);
process.exit(successes === iterations && successes > 0 && hashes.size === 1 ? 0 : 1);
