// パリティスナップショット — DDD 移行（issue #12）の安全網。
//
// 全 9 センサーを全 fixture シナリオへ発火し、観測面（findings ファイルの
// バイト・stdout verdict 行・exit code）を決定論的なツリーへ書き出す。
// リファクタ前後でこのツリーを `diff -r` して空であることが、golden 15
// ファイルより広い互換性証明になる（verdict 行と exit code は golden に
// 含まれないため）。
//
// 使い方:  bun tests/parity/snapshot.ts <outDir>
// テストからは snapshotAll(outDir) を直接呼ぶ。
//
// 前提: node ランタイム（z3 child 用）と pinned quint が存在すること。
// 欠けたまま走ると unavailable 降格ドキュメントを「正」として記録して
// しまうため、欠如は即座にエラーで落とす（silent fake-green の防止）。

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");

const quintEnv = {
  AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation",
  AIDLC_DEEP_SPEC_QUINT_BIN: quintBin,
};

interface SensorFire {
  // スナップショットツリー上のラベル（ファイル名になる）
  label: string;
  tool: string;
  stage: string;
  // レコードルートからの相対 output-path
  outputPath: string[];
  env?: { [k: string]: string };
}

interface Scenario {
  name: string;
  // fixture ツリーをレコードへ複製する（record ルートを返す）
  seed: (record: string) => void;
  fires: SensorFire[];
  // 発火後に丸ごと捕獲するディレクトリ（レコードルートからの相対）
  captureDirs: string[][];
}

const SCENARIOS: Scenario[] = [
  {
    name: "conformance",
    seed: (record) => {
      mkdirSync(join(record, "inception", "requirements-analysis"), { recursive: true });
      mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
      cpSync(
        join(fixtures, "conformance", "requirements.md"),
        join(record, "inception", "requirements-analysis", "requirements.md"),
      );
      cpSync(
        join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"),
        join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"),
      );
    },
    fires: [
      {
        label: "ir-valid",
        tool: "aidlc-sensor-deep-spec-ir-valid.ts",
        stage: "deep-spec-analysis-verify",
        outputPath: ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"],
      },
      {
        label: "verify-smt",
        tool: "aidlc-sensor-deep-spec-verify-smt.ts",
        stage: "deep-spec-analysis-verify",
        outputPath: ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"],
      },
      {
        label: "verify-quint",
        tool: "aidlc-sensor-deep-spec-verify-quint.ts",
        stage: "deep-spec-analysis-verify",
        outputPath: ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"],
        env: quintEnv,
      },
    ],
    captureDirs: [["inception", "deep-spec-analysis-verify", "deep-spec-verify"]],
  },
  {
    name: "conformance-invalid",
    seed: (record) => {
      mkdirSync(join(record, "inception", "requirements-analysis"), { recursive: true });
      mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
      cpSync(
        join(fixtures, "conformance", "requirements.md"),
        join(record, "inception", "requirements-analysis", "requirements.md"),
      );
      cpSync(
        join(fixtures, "invalid", "deep-spec-analysis-formal-model.md"),
        join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"),
      );
    },
    fires: [
      {
        label: "ir-valid",
        tool: "aidlc-sensor-deep-spec-ir-valid.ts",
        stage: "deep-spec-analysis-verify",
        outputPath: ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"],
      },
    ],
    captureDirs: [],
  },
  ...(["broken", "clean"] as const).map((variant): Scenario => ({
    name: `refcheck-${variant}`,
    seed: (record) => {
      cpSync(join(fixtures, "refcheck", variant), record, { recursive: true });
    },
    fires: [
      {
        label: "refcheck-domain",
        tool: "aidlc-sensor-deep-spec-refcheck-domain.ts",
        stage: "refcheck-parity",
        outputPath: ["inception", "domain-design", "components.md"],
      },
      {
        label: "refcheck-contract",
        tool: "aidlc-sensor-deep-spec-refcheck-contract.ts",
        stage: "refcheck-parity",
        outputPath: ["inception", "contract-design", "contract-summary.md"],
      },
      {
        label: "refcheck-functional",
        tool: "aidlc-sensor-deep-spec-refcheck-functional.ts",
        stage: "refcheck-parity",
        outputPath: ["construction", "u1-orders", "functional-design", "entities.md"],
      },
    ],
    captureDirs: [
      ["inception", "domain-design", "deep-spec-refcheck"],
      ["inception", "contract-design", "deep-spec-refcheck"],
      ["construction", "u1-orders", "functional-design", "deep-spec-refcheck"],
    ],
  })),
  {
    name: "design",
    seed: (record) => {
      cpSync(join(fixtures, "design", "record"), record, { recursive: true });
    },
    fires: [
      {
        label: "design-ir-valid",
        tool: "aidlc-sensor-deep-spec-design-ir-valid.ts",
        stage: "deep-spec-analysis-functional-verify",
        outputPath: ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"],
      },
      {
        label: "design-verify-smt",
        tool: "aidlc-sensor-deep-spec-design-verify-smt.ts",
        stage: "deep-spec-analysis-functional-verify",
        outputPath: ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"],
      },
      {
        label: "design-verify-quint",
        tool: "aidlc-sensor-deep-spec-design-verify-quint.ts",
        stage: "deep-spec-analysis-functional-verify",
        outputPath: ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"],
        env: quintEnv,
      },
    ],
    captureDirs: [["construction", "deep-spec-analysis-functional-verify", "deep-spec-design-verify"]],
  },
  {
    name: "refinement",
    seed: (record) => {
      cpSync(join(fixtures, "refinement", "record"), record, { recursive: true });
    },
    fires: [
      {
        label: "design-verify-smt",
        tool: "aidlc-sensor-deep-spec-design-verify-smt.ts",
        stage: "deep-spec-analysis-functional-verify",
        outputPath: ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"],
      },
      {
        label: "design-verify-quint",
        tool: "aidlc-sensor-deep-spec-design-verify-quint.ts",
        stage: "deep-spec-analysis-functional-verify",
        outputPath: ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"],
        env: quintEnv,
      },
    ],
    captureDirs: [["construction", "deep-spec-analysis-functional-verify", "deep-spec-design-verify"]],
  },
];

export function assertSolversPresent(): void {
  const node = spawnSync("node", ["--version"], { encoding: "utf-8", timeout: 10_000 });
  if (node.error || node.status !== 0) {
    throw new Error("parity snapshot requires a node runtime (z3 child) — refusing to record degraded output as truth");
  }
  if (!existsSync(quintBin)) {
    throw new Error(`parity snapshot requires the pinned quint at ${quintBin} — run bun install first`);
  }
}

function captureTree(src: string, dst: string): void {
  for (const entry of readdirSync(src).sort()) {
    const from = join(src, entry);
    if (statSync(from).isDirectory()) {
      captureTree(from, join(dst, entry));
    } else {
      mkdirSync(dst, { recursive: true });
      cpSync(from, join(dst, entry));
    }
  }
}

export function snapshotAll(outDir: string): void {
  assertSolversPresent();
  for (const scenario of SCENARIOS) {
    const record = join(tmpdir(), `deep-spec-parity-${Math.random().toString(36).slice(2)}`);
    mkdirSync(record, { recursive: true });
    try {
      scenario.seed(record);
      const scenarioOut = join(outDir, scenario.name);
      for (const fire of scenario.fires) {
        const res = spawnSync(
          "bun",
          [join(toolsDir, fire.tool), "--stage", fire.stage, "--output-path", join(record, ...fire.outputPath)],
          { encoding: "utf-8", timeout: 240_000, env: { ...process.env, ...(fire.env ?? {}) } },
        );
        if (res.error) throw new Error(`${scenario.name}/${fire.label}: spawn failed: ${res.error.message}`);
        mkdirSync(scenarioOut, { recursive: true });
        writeFileSync(join(scenarioOut, `${fire.label}.stdout`), res.stdout ?? "");
        writeFileSync(join(scenarioOut, `${fire.label}.exit`), `${res.status}\n`);
      }
      for (const dir of scenario.captureDirs) {
        const src = join(record, ...dir);
        if (existsSync(src)) captureTree(src, join(scenarioOut, "files", ...dir));
      }
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  }
}

if (import.meta.main) {
  const outDir = process.argv[2];
  if (!outDir) {
    process.stderr.write("usage: bun tests/parity/snapshot.ts <outDir>\n");
    process.exit(1);
  }
  rmSync(outDir, { recursive: true, force: true });
  snapshotAll(outDir);
  process.stdout.write(`parity snapshot written to ${outDir}\n`);
}
