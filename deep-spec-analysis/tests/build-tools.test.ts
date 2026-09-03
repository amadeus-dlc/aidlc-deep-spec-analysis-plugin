// 配布物 tools/ の生成器テスト（FR3.2 / FR3.3 / NFR1 / NFR4）。
//
// tools/ は src/entries/ から機械生成した成果物を git に置いたもの。原本と
// 配布物が食い違えばディスパッチャが古い挙動を実行するので、ここでは
//   1. drift guard   — コミット済み tools/ が src/ と一致する（--check が exit 0）
//   2. 検出力の証明  — 変更・欠落・余剰をそれぞれ --check が非ゼロで名指しする
//   3. 決定論        — 同一ソースから 2 回生成して byte 同一（NFR1）
//   4. 出荷形        — .ts 10 本＋data/*.json 4 本ちょうど、各 bundle は上限内
//                      （中身は bundle 済み JS。上流ディスパッチャが manifest の
//                       command から .ts で終わるトークンを探すので拡張子は .ts）
// を表明する。
//
// 3 の比較先は一時ディレクトリ。バンドルが埋め込むソースパスは cwd 相対なので
// 出力先を変えても byte は変わらず、コミット済み tools/ を触らずに検証できる。

import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const generator = join("scripts", "build-tools.ts");
const toolsDir = join(pluginRoot, "tools");

// NFR4 の上限（オーナー裁定 2026-09-03）。目的は異常な肥大化の検出であって
// 特定の数値ではない。実測は 49〜300 KB（241 モジュールを束ねる design 系
// 3 本が上端）なので、単位解釈で揺れない 512 KiB を上限に置く。
const MAX_BUNDLE_BYTES = 512 * 1024;
const DATA_LEAF = "data";
const EXPECTED_BUNDLES = 10;
const EXPECTED_SCHEMAS = 4;
// 10 本の生成は実測 100ms 程度（NFR3 は 10 秒）。spawn の上限はその十分な上。
const BUILD_TIMEOUT_MS = 120_000;

const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

function runGenerator(args: readonly string[]): { status: number | null; output: string } {
  const res = spawnSync("bun", [generator, ...args], {
    cwd: pluginRoot,
    encoding: "utf-8",
    timeout: BUILD_TIMEOUT_MS,
  });
  expect(res.error).toBeUndefined();
  return { status: res.status, output: `${res.stdout ?? ""}\n${res.stderr ?? ""}` };
}

// コミット済み tools/ の複製に手を入れて --check にかける。原本は触らない。
function corruptedCopy(mutate: (dir: string) => void): { status: number | null; output: string } {
  const dir = join(scratch("deep-spec-tools-copy-"), "tools");
  cpSync(toolsDir, dir, { recursive: true });
  mutate(dir);
  return runGenerator(["--check", "--out", dir]);
}

function bundleNames(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => e.name)
    .sort();
}

describe("build-tools drift guard", () => {
  test("committed tools/ is up to date with src/", () => {
    const { status, output } = runGenerator(["--check"]);
    expect(output).not.toContain("changed:");
    expect(output).not.toContain("missing:");
    expect(output).not.toContain("extra:");
    expect(status).toBe(0);
  });

  test("--check names a bundle whose bytes drifted", () => {
    const victim = "deep-spec-analysis-doctor.ts";
    const { status, output } = corruptedCopy((dir) => {
      const target = join(dir, victim);
      const bytes = readFileSync(target);
      // 1 バイトだけ変える（長さは保つ）。サイズ比較ではなく内容比較であることの証明。
      bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0x01;
      writeFileSync(target, bytes);
    });
    expect(status).not.toBe(0);
    expect(output).toContain(`changed: ${victim}`);
  });

  test("--check names a bundle that is missing", () => {
    const victim = "aidlc-sensor-deep-spec-ir-valid.ts";
    const { status, output } = corruptedCopy((dir) => rmSync(join(dir, victim)));
    expect(status).not.toBe(0);
    expect(output).toContain(`missing: ${victim}`);
  });

  test("--check names a stale bundle no entry produces", () => {
    const stray = "aidlc-sensor-deep-spec-removed.ts";
    const { status, output } = corruptedCopy((dir) => writeFileSync(join(dir, stray), "// stale\n"));
    expect(status).not.toBe(0);
    expect(output).toContain(`extra: ${stray}`);
  });
});

describe("build-tools determinism (NFR1)", () => {
  test("two runs from the same source produce byte-identical bundles", () => {
    const first = join(scratch("deep-spec-tools-a-"), "tools");
    const second = join(scratch("deep-spec-tools-b-"), "tools");
    expect(runGenerator(["--out", first]).status).toBe(0);
    expect(runGenerator(["--out", second]).status).toBe(0);

    const names = bundleNames(first);
    expect(names).toHaveLength(EXPECTED_BUNDLES);
    expect(bundleNames(second)).toEqual(names);
    for (const name of names) {
      expect(readFileSync(join(first, name)).equals(readFileSync(join(second, name)))).toBe(true);
    }
  });
});

describe("build-tools shipping shape (FR2.1 / NFR4)", () => {
  const top = readdirSync(toolsDir, { withFileTypes: true });

  test("tools/ holds exactly the 10 bundles and the data/ directory", () => {
    expect(top.filter((e) => e.isFile() && e.name.endsWith(".ts"))).toHaveLength(EXPECTED_BUNDLES);
    // ディスパッチャは basename で解決するので入れ子は data/ ひとつだけ。
    expect(top.filter((e) => e.isDirectory()).map((e) => e.name)).toEqual([DATA_LEAF]);
    expect(top.filter((e) => e.isFile() && !e.name.endsWith(".ts"))).toHaveLength(0);
  });

  test("no bare .js artifact ships in tools/", () => {
    // 出荷物の中身は bundle 済み JS だが、ファイル名は必ず .ts。上流の
    // resolveScriptPath が command から .ts で終わるトークンを探すため。
    expect(top.filter((e) => e.name.endsWith(".js"))).toHaveLength(0);
    const schemas = readdirSync(join(toolsDir, DATA_LEAF), { withFileTypes: true });
    expect(schemas.filter((e) => e.name.endsWith(".js"))).toHaveLength(0);
  });

  test("tools/data holds exactly the 4 contract schemas", () => {
    const schemas = readdirSync(join(toolsDir, DATA_LEAF), { withFileTypes: true });
    expect(schemas.filter((e) => e.isFile() && e.name.endsWith(".json"))).toHaveLength(EXPECTED_SCHEMAS);
    expect(schemas).toHaveLength(EXPECTED_SCHEMAS);
  });

  test("tools/ ships 14 files in total", () => {
    const total = top.filter((e) => e.isFile()).length + readdirSync(join(toolsDir, DATA_LEAF)).length;
    expect(total).toBe(EXPECTED_BUNDLES + EXPECTED_SCHEMAS);
  });

  test("every bundle stays under the size ceiling", () => {
    const oversized = bundleNames(toolsDir)
      .map((name) => ({ name, size: statSync(join(toolsDir, name)).size }))
      .filter((b) => b.size > MAX_BUNDLE_BYTES);
    expect(oversized).toEqual([]);
  });
});
