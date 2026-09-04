// パッケージ境界の検出時点を固定する（FR1.3 / NFR5）。
//
// src/<ctx>/<layer>/ の 16 層はそれぞれ独立した workspace パッケージで、
// bunfig.toml の `linker = "isolated"` により node_modules には
// package.json の dependencies に宣言した層だけが張られる。したがって
//   - 宣言した層への bare import は解決できる
//   - 宣言していない層への bare import は解決できない
//   - exports に無い深いパスは（宣言済みの層でも）解決できない
// が成り立つ。この 3 点が壊れると層規律は実行時に素通りするため、
// import 時点（実行時）と型検査時点の両方で表明する。
//
// 実行時側は実ツリーをそのまま検査する——`bun -e` の cwd を実パッケージの
// ディレクトリに置くと、bun はそのディレクトリの node_modules から解決する。
// テスト用の payload を src/ に置かずに済む（no-test-payloads 規則）。
//
// 型検査側は一時ディレクトリの fixture を tsc にかける。fixture の
// node_modules は `bun install --linker isolated` が作る形（宣言した層だけ
// を実ディレクトリへ張ったシンボリックリンク）を再現し、リンク先は実物の
// パッケージなので exports ゲートは本番の package.json のものが働く。

import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPAWN_TIMEOUT_MS = 120_000;

// --- 実行時解決（実ツリー） -------------------------------------------------

interface Resolution {
  readonly resolved: boolean;
  readonly stderr: string;
}

/** `from` パッケージのディレクトリを cwd にして `specifier` の動的 import を試す。 */
function resolveFrom(from: string, specifier: string): Resolution {
  const cwd = join(pluginRoot, from);
  if (!existsSync(cwd)) throw new Error(`package directory not found: ${cwd}`);
  const res = spawnSync("bun", ["-e", `await import(${JSON.stringify(specifier)});`], {
    cwd,
    encoding: "utf-8",
    timeout: SPAWN_TIMEOUT_MS,
  });
  if (res.error) throw new Error(`failed to spawn bun for ${from}: ${res.error.message}`);
  return { resolved: res.status === 0, stderr: res.stderr ?? "" };
}

// --- 型検査（一時 fixture） -------------------------------------------------

const fixtureDir = mkdtempSync(join(tmpdir(), "deep-spec-package-boundaries-"));
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

function buildFixture(): void {
  // 宣言した層だけを張る——isolated linker が作る形をそのまま再現する。
  const linkRoot = join(fixtureDir, "node_modules", "@deep-spec");
  mkdirSync(linkRoot, { recursive: true });
  symlinkSync(join(pluginRoot, "src", "kernel", "domain"), join(linkRoot, "kernel-domain"), "dir");
  // 実ツリーでは root の devDependencies が上位探索で見えるので、fixture でも
  // @types を同じように見せる（見せないと node: 組込みの型が落ちて、境界とは
  // 無関係な診断が混ざる）。
  symlinkSync(join(pluginRoot, "node_modules", "@types"), join(fixtureDir, "node_modules", "@types"), "dir");

  writeFileSync(
    join(fixtureDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@deep-spec/package-boundaries-fixture",
        private: true,
        type: "module",
        dependencies: { "@deep-spec/kernel-domain": "workspace:*" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(fixtureDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          lib: ["ESNext"],
          module: "ESNext",
          moduleResolution: "bundler",
          moduleDetection: "force",
          allowImportingTsExtensions: true,
          noEmit: true,
          strict: true,
          skipLibCheck: true,
          types: ["bun"],
        },
        include: ["*.ts"],
      },
      null,
      2,
    )}\n`,
  );

  // 宣言済みの層をファサード経由で使う——通るべき例。
  writeFileSync(
    join(fixtureDir, "declared.ts"),
    'import { ArtifactPath } from "@deep-spec/kernel-domain";\nexport const probe = ArtifactPath;\n',
  );
  // 宣言していない層——解決できないべき例。
  writeFileSync(
    join(fixtureDir, "undeclared.ts"),
    'import { DesignModelId } from "@deep-spec/design-domain";\nexport const probe = DesignModelId;\n',
  );
  // exports に無い深いパス——宣言済みの層でも解決できないべき例。
  writeFileSync(
    join(fixtureDir, "deep-path.ts"),
    'import type { Expression } from "@deep-spec/kernel-domain/expression.ts";\nexport type Probe = Expression;\n',
  );
}

interface Diagnostic {
  readonly file: string;
  readonly code: string;
}

/** tsc の診断行 `<path>(行,列): error TSxxxx: ...` をファイル名とコードに落とす。 */
function parseDiagnostics(output: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of output.split("\n")) {
    const m = /^(.*?)\(\d+,\d+\): error (TS\d+):/.exec(line);
    if (m) out.push({ file: basename(m[1]), code: m[2] });
  }
  return out;
}

function typeCheckFixture(): string {
  const tsc = join(pluginRoot, "node_modules", ".bin", "tsc");
  if (!existsSync(tsc)) throw new Error(`tsc not found at ${tsc} — run \`bun install\` first`);
  const res = spawnSync(tsc, ["--noEmit", "--project", join(fixtureDir, "tsconfig.json")], {
    encoding: "utf-8",
    timeout: SPAWN_TIMEOUT_MS,
  });
  if (res.error) throw new Error(`failed to spawn tsc: ${res.error.message}`);
  return `${res.stdout ?? ""}${res.stderr ?? ""}`;
}

buildFixture();
const typeCheckOutput = typeCheckFixture();
const diagnostics = parseDiagnostics(typeCheckOutput);
const diagnosticsFor = (file: string): Diagnostic[] => diagnostics.filter((d) => d.file === file);

describe("declared package boundaries (FR1.3 / NFR5)", () => {
  test("a declared layer resolves — at import time and at type-check time", () => {
    // requirements/domain は package.json で @deep-spec/kernel-domain を宣言している。
    const runtime = resolveFrom("src/requirements/domain", "@deep-spec/kernel-domain");
    expect(runtime.resolved).toBe(true);
    // fixture 側でも declared.ts には診断が出ない。
    expect(diagnosticsFor("declared.ts")).toEqual([]);
  });

  test("an undeclared layer does not resolve — at import time and at type-check time", () => {
    // kernel/infrastructure は最内層で依存を 1 つも宣言していない。
    const runtime = resolveFrom("src/kernel/infrastructure", "@deep-spec/kernel-domain");
    expect(runtime.resolved).toBe(false);
    expect(runtime.stderr).toContain("Cannot find module '@deep-spec/kernel-domain'");
    expect(diagnosticsFor("undeclared.ts").map((d) => d.code)).toEqual(["TS2307"]);
  });

  test("a deep path outside exports does not resolve — at import time and at type-check time", () => {
    const runtime = resolveFrom("src/requirements/domain", "@deep-spec/kernel-domain/expression.ts");
    expect(runtime.resolved).toBe(false);
    expect(runtime.stderr).toContain("Cannot find module '@deep-spec/kernel-domain/expression.ts'");
    expect(diagnosticsFor("deep-path.ts").map((d) => d.code)).toEqual(["TS2307"]);
  });
});
