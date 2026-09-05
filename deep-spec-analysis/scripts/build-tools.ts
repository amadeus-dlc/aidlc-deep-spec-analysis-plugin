#!/usr/bin/env bun
// build-tools.ts — src/entries/ の合成ルートを配布物 tools/ へ束ねる生成器。
//
// 出荷形（FR2.1）: tools/ は「entry ごとの .ts 10 本」＋「data/ の契約スキーマ
// 4 本」の計 14 ファイルちょうど。中身は bundle 済みの JavaScript だが、上流の
// センサーディスパッチャが manifest の command から「.ts で終わるトークン」を
// 探して起動スクリプトを決める（無ければ dispatchError）ため、出荷物のファイル
// 名は .ts に保つ。ディスパッチャは entry を basename で解決するので tools/ 直下
// はフラットに置く。entry は
// dirname(fileURLToPath(import.meta.url)) を基点に data/ と兄弟 entry を解決する
// ため、この隣接関係（tools/<entry>.ts と tools/data/ が同階層）が契約になる。
// 原本も同じ理由で src/entries/data/ に置く——ソースツリーでも entry から見た
// data/ が同じ相対で解決でき、`bun src/entries/<entry>.ts` の直接実行が生きる。
//
// 生成条件（FR2.2 / 裁定 [Q3]）は固定で、緩めない:
//   --target=bun        SMT entry が --smt-child で自分自身を node で再起動する
//                       ため、先頭の `var __require = import.meta.require;` が
//                       node 24 でも無害であることを実測済み（docs/decisions A1）。
//   --external z3-solver  z3 の WASM はバンドルに畳まない。
//   --sourcemap=none    生成物に外部参照を持たせない。
//   minify なし / code splitting なし
//                       chunk 名の揺れでマニフェストと doctor が不安定になるのを
//                       避ける。1 entry = 1 ファイルの対応を保つ。
//
// 決定論（NFR1）: 同一ソース・同一 bun 版なら生成物は byte 同一。バンドルが
// 埋め込むソースパスは cwd 相対なので、出力先ディレクトリを変えても byte は
// 変わらない（--out で一時ディレクトリへ生成しても比較が成立する）。
//
// 使い方:
//   bun scripts/build-tools.ts              tools/ を生成する
//   bun scripts/build-tools.ts --out <dir>  <dir> を tools/ の代わりに生成先にする
//   bun scripts/build-tools.ts --check      再生成してコミット済み tools/ と比較し、
//                                           差分があればファイル名を挙げて非ゼロ終了
//   bun scripts/build-tools.ts --check --out <dir>  比較先を <dir> にする

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES_DIR = join(ROOT, "src", "entries");
const DATA_DIR = join(ROOT, "src", "entries", "data");
const DEFAULT_OUT = join(ROOT, "tools");
const DATA_LEAF = "data";

const BUILD_FLAGS = ["--target=bun", "--external", "z3-solver", "--sourcemap=none"] as const;

function fail(message: string): never {
  process.stderr.write(`build-tools: ${message}\n`);
  process.exit(1);
}

// ---- 入力の解決 -------------------------------------------------------------

interface Options {
  readonly check: boolean;
  readonly outDir: string;
}

function parseOptions(argv: readonly string[]): Options {
  let check = false;
  let outDir = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") {
      check = true;
    } else if (arg === "--out") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) fail("--out requires a directory path");
      outDir = resolve(value);
      i++;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return { check, outDir };
}

// 合成ルートの一覧はディレクトリが正（tests/architecture の ENTRY_FILES が
// 「entries/ 直下は .ts 10 本ちょうど」を別途表明している）。isolated linker が
// 作る node_modules/ と package.json は束ねる対象ではない。
function entryFiles(): string[] {
  if (!existsSync(ENTRIES_DIR)) fail(`entries directory not found: ${relative(ROOT, ENTRIES_DIR)}`);
  let names: string[];
  try {
    names = readdirSync(ENTRIES_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => e.name)
      .sort();
  } catch (error) {
    return fail(`cannot read ${relative(ROOT, ENTRIES_DIR)}: ${(error as Error).message}`);
  }
  if (names.length === 0) fail(`no entry sources under ${relative(ROOT, ENTRIES_DIR)}`);
  return names;
}

function dataFiles(): string[] {
  if (!existsSync(DATA_DIR)) fail(`contract schema directory not found: ${relative(ROOT, DATA_DIR)}`);
  let names: string[];
  try {
    names = readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name)
      .sort();
  } catch (error) {
    return fail(`cannot read ${relative(ROOT, DATA_DIR)}: ${(error as Error).message}`);
  }
  if (names.length === 0) fail(`no contract schemas under ${relative(ROOT, DATA_DIR)}`);
  return names;
}

// ---- 生成 -------------------------------------------------------------------

// 生成先に置かれるべきファイル（<out> からの相対パス）。
function generate(outDir: string): string[] {
  const entries = entryFiles();
  const schemas = dataFiles();
  const produced: string[] = [];

  try {
    mkdirSync(outDir, { recursive: true });
    mkdirSync(join(outDir, DATA_LEAF), { recursive: true });
  } catch (error) {
    fail(`cannot create ${outDir}: ${(error as Error).message}`);
  }

  for (const entry of entries) {
    // 出荷物名は entry のソース名そのまま。中身は bundle 済み JS だが、上流の
    // ディスパッチャが .ts で終わるトークンを要求するので拡張子は変えない。
    const bundleName = entry;
    const outFile = join(outDir, bundleName);
    // cwd を ROOT に固定する。バンドルはソースパスを cwd 相対で埋め込むので、
    // ここが揺れると同じソースから byte の違う生成物が出る（NFR1）。
    const built = spawnSync(
      process.execPath,
      ["build", join("src", "entries", entry), ...BUILD_FLAGS, "--outfile", outFile],
      { cwd: ROOT, encoding: "utf8" },
    );
    if (built.error) fail(`bun build failed for ${entry}: ${built.error.message}`);
    if (built.status !== 0) {
      process.stderr.write(built.stderr || built.stdout || "");
      fail(`bun build exited with status ${built.status} for ${entry}`);
    }
    if (!existsSync(outFile)) fail(`bun build reported success but produced no ${bundleName}`);
    produced.push(bundleName);
  }

  for (const schema of schemas) {
    const rel = join(DATA_LEAF, schema);
    try {
      writeFileSync(join(outDir, rel), readFileSync(join(DATA_DIR, schema)));
    } catch (error) {
      fail(`cannot sync ${rel}: ${(error as Error).message}`);
    }
    produced.push(rel);
  }

  return produced;
}

// 生成物ディレクトリが所有する形は「直下の .ts」と「data/ 直下の .json」だけ。
// 旧 entry がリネーム・削除されたときに古いバンドルが残ると出荷形が壊れるので、
// その 2 パターンに限って掃除する（他のパスには触れない）。
function pruneStale(outDir: string, produced: readonly string[]): string[] {
  const keep = new Set(produced);
  const removed: string[] = [];
  for (const rel of ownedFiles(outDir)) {
    if (keep.has(rel)) continue;
    try {
      rmSync(join(outDir, rel));
    } catch (error) {
      fail(`cannot remove stale ${rel}: ${(error as Error).message}`);
    }
    removed.push(rel);
  }
  return removed;
}

function ownedFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".ts")) out.push(entry.name);
  }
  const dataDir = join(dir, DATA_LEAF);
  if (existsSync(dataDir)) {
    for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) out.push(join(DATA_LEAF, entry.name));
    }
  }
  return out.sort();
}

// ---- --check ----------------------------------------------------------------

function checkAgainst(committedDir: string): number {
  const scratch = mkdtempSync(join(tmpdir(), "deep-spec-build-tools-"));
  try {
    const produced = generate(scratch);
    const expected = new Set(produced);
    const drift: string[] = [];

    for (const rel of produced) {
      const committedPath = join(committedDir, rel);
      if (!existsSync(committedPath)) {
        drift.push(`missing: ${rel}`);
        continue;
      }
      let same: boolean;
      try {
        same = readFileSync(committedPath).equals(readFileSync(join(scratch, rel)));
      } catch (error) {
        drift.push(`unreadable: ${rel} (${(error as Error).message})`);
        continue;
      }
      if (!same) drift.push(`changed: ${rel}`);
    }

    for (const rel of ownedFiles(committedDir)) {
      if (!expected.has(rel)) drift.push(`extra: ${rel}`);
    }

    if (drift.length > 0) {
      process.stderr.write(
        `build-tools: ${relative(ROOT, committedDir) || committedDir} is out of date with src/ (${drift.length} file(s)):\n`,
      );
      for (const line of drift.sort()) process.stderr.write(`  ${line}\n`);
      process.stderr.write("build-tools: run `bun scripts/build-tools.ts` and commit the result\n");
      return 1;
    }

    process.stdout.write(`build-tools: ${produced.length} file(s) up to date\n`);
    return 0;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ---- main -------------------------------------------------------------------

const options = parseOptions(process.argv.slice(2));

if (options.check) {
  if (!existsSync(options.outDir)) fail(`nothing to check: ${options.outDir} does not exist`);
  process.exit(checkAgainst(options.outDir));
}

const started = Date.now();
const produced = generate(options.outDir);
const removed = pruneStale(options.outDir, produced);
for (const rel of removed) process.stdout.write(`  removed ${rel}\n`);
for (const rel of produced) {
  process.stdout.write(`  ${rel} (${statSync(join(options.outDir, rel)).size} bytes)\n`);
}
process.stdout.write(
  `build-tools: wrote ${produced.length} file(s) to ${relative(ROOT, options.outDir) || options.outDir} in ${Date.now() - started}ms\n`,
);
