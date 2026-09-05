#!/usr/bin/env bun

// install.ts — one-command installer for the deep-spec-analysis plugin.
//
// Automates the folder-drop flow documented in aidlc-workflows
// docs/reference/18-plugin-mechanism.md: build the harness projection with
// aidlc-plugin-build.ts, copy it into the target project (the drop IS the
// trust decision — there is no store trust gate on this path), then compose
// via `aidlc plugin sync` or, when the aidlc CLI is absent, by running the
// projection's hooks/compose.ts directly. Compose is idempotent, so
// re-running the installer is safe.
//
// Usage: bun deep-spec-analysis/scripts/install.ts --project <path>
//        [--harness claude] [--dry-run] [--skip-build]

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const USAGE =
  "Usage: bun deep-spec-analysis/scripts/install.ts --project <path> [--harness <name>] [--from <repo-root> | --ref <branch> | --tag <tag>] [--update] [--dry-run] [--skip-build]";

const REPOSITORY = "j5ik2o/deep-spec-analysis";
const PLUGIN_NAME = "deep-spec-analysis";
const PROVENANCE_FILE = "deep-spec-analysis-install.json";

export type SourceKind = "local" | "ref" | "tag" | "latest";

export interface InstallationProvenance {
  readonly version: string;
  readonly ref: string;
  readonly source: SourceKind;
  readonly installed_at: string;
  readonly payload_sha256: string;
}

interface ResolvedSource {
  readonly pluginRoot: string;
  readonly source: SourceKind;
  readonly ref: string;
  readonly requestedTag: string | null;
  readonly cleanupRoot: string | null;
}

interface Manifest {
  readonly name?: unknown;
  readonly version?: unknown;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function parseStableSemver(value: string): readonly [number, number, number] | null {
  const match = value.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function latestStableTag(tags: readonly string[]): string | null {
  return (
    tags
      .map((tag) => ({ tag, parsed: parseStableSemver(tag) }))
      .filter((entry): entry is { tag: string; parsed: readonly [number, number, number] } => entry.parsed !== null)
      .sort((a, b) => {
        for (let i = 0; i < 3; i++) {
          const difference = b.parsed[i] - a.parsed[i];
          if (difference !== 0) return difference;
        }
        return a.tag.localeCompare(b.tag);
      })[0]?.tag ?? null
  );
}

export function selectSourceSelector(input: { readonly from?: string; readonly ref?: string; readonly tag?: string }): {
  readonly kind: SourceKind;
  readonly value: string;
} {
  if (input.from) return { kind: "local", value: input.from };
  if (input.ref) return { kind: "ref", value: input.ref };
  if (input.tag) return { kind: "tag", value: input.tag };
  return { kind: "latest", value: "" };
}

export function canonicalPayloadSha256(
  entries: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): string {
  const digest = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))) {
    digest.update(entry.path);
    digest.update("\0");
    digest.update(entry.bytes);
    digest.update("\0");
  }
  return `sha256:${digest.digest("hex")}`;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function tarText(bytes: Uint8Array, start: number, length: number): string {
  const end = bytes.subarray(start, start + length).indexOf(0);
  return new TextDecoder().decode(bytes.subarray(start, start + (end < 0 ? length : end))).trim();
}

export function extractTarGz(archive: Uint8Array, destination: string): void {
  const bytes = Bun.gunzipSync(archive.slice().buffer as ArrayBuffer);
  mkdirSync(destination, { recursive: true });
  for (let offset = 0; offset + 512 <= bytes.length; ) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    const entryName = prefix ? `${prefix}/${name}` : name;
    const sizeText = tarText(header, 124, 12);
    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`invalid tar size for ${entryName}`);
    if (!entryName || entryName.startsWith("/") || entryName.split("/").includes("..")) {
      throw new Error(`unsafe archive path: ${entryName || "<empty>"}`);
    }
    const target = resolve(destination, entryName);
    if (!isInside(destination, target)) throw new Error(`archive entry escapes extraction root: ${entryName}`);
    const type = String.fromCharCode(header[156] ?? 0);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > bytes.length) throw new Error(`truncated tar entry: ${entryName}`);
    if (type === "2" || type === "1") {
      throw new Error(`archive links are not allowed: ${entryName}`);
    }
    if (type === "5") {
      mkdirSync(target, { recursive: true });
    } else if (type === "0" || type === "\0" || type === "") {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes.subarray(bodyStart, bodyEnd));
    } else if (type !== "x" && type !== "g" && type !== "L") {
      throw new Error(`unsupported tar entry type ${JSON.stringify(type)}: ${entryName}`);
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
}

function findPluginRoot(root: string): string | null {
  const visit = (directory: string): string | null => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const child = join(directory, entry.name);
      if (entry.name === PLUGIN_NAME && existsSync(join(child, ".aidlc-plugin", "plugin.json"))) return child;
      const nested = visit(child);
      if (nested) return nested;
    }
    return null;
  };
  return visit(root);
}

async function fetchBytes(url: string, fetcher: Fetcher): Promise<Uint8Array> {
  const response = await fetcher(url, { headers: { "User-Agent": "deep-spec-analysis-installer" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function resolveLatestTag(fetcher: Fetcher = fetch): Promise<string> {
  const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}/tags?per_page=100`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "deep-spec-analysis-installer" },
  });
  if (!response.ok) throw new Error(`GitHub tags API returned HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("GitHub tags API returned an invalid document");
  const names = body.flatMap((entry) =>
    entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string"
      ? [(entry as { name: string }).name]
      : [],
  );
  if (names.length === 0) throw new Error("GitHub tags API returned no tags");
  const tag = latestStableTag(names);
  if (!tag) throw new Error("GitHub repository has no stable Semantic Versioning tag");
  return tag;
}

export async function acquireRemote(
  kind: "ref" | "tag" | "latest",
  requested: string,
  fetcher: Fetcher = fetch,
): Promise<ResolvedSource> {
  const resolvedRef = kind === "latest" ? await resolveLatestTag(fetcher) : requested;
  const namespace = kind === "ref" ? "heads" : "tags";
  const url = `https://codeload.github.com/${REPOSITORY}/tar.gz/refs/${namespace}/${encodeURIComponent(resolvedRef)}`;
  const cleanupRoot = mkdtempSync(join(tmpdir(), "deep-spec-analysis-source-"));
  try {
    extractTarGz(await fetchBytes(url, fetcher), cleanupRoot);
    const pluginRoot = findPluginRoot(cleanupRoot);
    if (!pluginRoot) throw new Error(`archive does not contain ${PLUGIN_NAME}/.aidlc-plugin/plugin.json`);
    return {
      pluginRoot,
      source: kind,
      ref: resolvedRef,
      requestedTag: kind === "ref" ? null : resolvedRef,
      cleanupRoot,
    };
  } catch (error) {
    rmSync(cleanupRoot, { recursive: true, force: true });
    throw error;
  }
}

export function acquireLocal(repoRoot: string): ResolvedSource {
  const root = resolve(repoRoot);
  if (existsSync(join(root, ".aidlc-plugin", "plugin.json"))) {
    throw new Error(
      `--from expects a repository root containing ${PLUGIN_NAME}/; the plugin root itself was provided: ${root}`,
    );
  }
  const pluginRoot = join(root, PLUGIN_NAME);
  if (!existsSync(join(pluginRoot, ".aidlc-plugin", "plugin.json"))) {
    throw new Error(`--from expects a repository root with ${PLUGIN_NAME}/.aidlc-plugin/plugin.json: ${root}`);
  }
  return { pluginRoot, source: "local", ref: root, requestedTag: null, cleanupRoot: null };
}

export function validateManifest(source: ResolvedSource): { manifest: Manifest; version: string } {
  const path = join(source.pluginRoot, ".aidlc-plugin", "plugin.json");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  } catch (error) {
    throw new Error(`cannot read plugin manifest ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest.name !== PLUGIN_NAME) throw new Error(`plugin manifest name must be ${PLUGIN_NAME}`);
  if (typeof manifest.version !== "string" || !parseStableSemver(manifest.version)) {
    throw new Error("plugin manifest version must be a stable Semantic Version");
  }
  if (source.requestedTag && source.requestedTag.replace(/^v/, "") !== manifest.version) {
    throw new Error(`tag ${source.requestedTag} does not match manifest version ${manifest.version}`);
  }
  return { manifest, version: manifest.version };
}

interface PluginTarget {
  harnessName: string;
  harnessLeaf: string;
  // "store" hosts (claude, codex, copilot, opencode) keep the plugin outside
  // the project, so compose reads straight from dist/ and nothing is copied.
  // The storeless kinds (kiro, kiro-ide, cursor) expect the projection
  // folder-dropped into the project root.
  kind: "store" | "kiro" | "kiro-ide" | "cursor";
}

function fail(message: string): never {
  console.error(`install: ${message}`);
  process.exit(1);
}

function run(label: string, command: string[], options: { cwd?: string; env?: Record<string, string> } = {}): void {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with status ${result.status}`);
}

// ---- arguments --------------------------------------------------------------

if (import.meta.main) {
  let projectArg = "";
  let harness = "claude";
  let dryRun = false;
  let skipBuild = false;
  let fromArg = "";
  let refArg = "";
  let tagArg = "";
  let update = false;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--project") projectArg = args[++i] ?? "";
    else if (arg === "--harness") harness = args[++i] ?? "";
    else if (arg === "--from") fromArg = args[++i] ?? "";
    else if (arg === "--ref") refArg = args[++i] ?? "";
    else if (arg === "--tag") tagArg = args[++i] ?? "";
    else if (arg === "--update") update = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--skip-build") skipBuild = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else fail(`unknown argument "${arg}"\n${USAGE}`);
  }
  if (!projectArg) fail(`--project is required\n${USAGE}`);

  // ---- workspace layout -------------------------------------------------------

  const projectDir = resolve(projectArg);
  if (!existsSync(projectDir)) fail(`project not found: ${projectDir}`);
  const harnessLeaves: Readonly<Record<string, string>> = {
    claude: ".claude",
    codex: ".codex",
    copilot: ".aidlc",
    cursor: ".cursor",
    kiro: ".kiro",
    "kiro-ide": ".kiro",
    opencode: ".aidlc",
  };
  const expectedLeaf = harnessLeaves[harness];
  if (!expectedLeaf)
    fail(`unknown harness "${harness}" — expected one of: ${Object.keys(harnessLeaves).sort().join(", ")}`);
  const toolsDir = join(projectDir, expectedLeaf, "tools");
  const builderPath = join(toolsDir, "aidlc-plugin-build.ts");
  const pluginTestPath = join(toolsDir, "aidlc-plugin-test.ts");
  const targetsPath = join(toolsDir, "data", "plugin-targets.json");
  if (!existsSync(builderPath) || !existsSync(pluginTestPath) || !existsSync(targetsPath)) {
    fail(
      `AI-DLC plugin toolchain is missing under ${toolsDir} — install AI-DLC for the ` +
        `"${harness}" harness first, then re-run this installer`,
    );
  }
  const targets = JSON.parse(readFileSync(targetsPath, "utf-8")) as Record<string, PluginTarget>;
  const target = targets[harness];
  if (!target) {
    fail(`unknown harness "${harness}" — expected one of: ${Object.keys(targets).sort().join(", ")}`);
  }

  if (!existsSync(join(projectDir, target.harnessLeaf))) {
    fail(
      `${projectDir} has no ${target.harnessLeaf}/ — install AI-DLC v2 for the ` +
        `"${harness}" harness there first (see aidlc-workflows dist/${harness}/)`,
    );
  }

  const provenancePath = join(projectDir, target.harnessLeaf, "tools", "data", PROVENANCE_FILE);

  function readProvenance(): InstallationProvenance | null {
    if (!existsSync(provenancePath)) return null;
    try {
      const value = JSON.parse(readFileSync(provenancePath, "utf-8")) as InstallationProvenance;
      if (
        typeof value.version !== "string" ||
        typeof value.ref !== "string" ||
        !["local", "ref", "tag", "latest"].includes(value.source) ||
        typeof value.installed_at !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(value.payload_sha256)
      )
        return null;
      return value;
    } catch {
      return null;
    }
  }

  const existingProvenance = readProvenance();
  if (update && (fromArg || refArg || tagArg)) fail("--update cannot be combined with --from, --ref, or --tag");
  if (update && !existingProvenance) {
    fail("--update requires installation provenance; run a normal install with --from, --ref, --tag, or latest first");
  }
  if (update && existingProvenance?.source === "tag") {
    console.log(`Changed 0 — fixed tag ${existingProvenance.ref} is already installed`);
    process.exit(0);
  }

  let resolvedSource: ResolvedSource;
  try {
    if (update && existingProvenance) {
      resolvedSource =
        existingProvenance.source === "local"
          ? acquireLocal(existingProvenance.ref)
          : await acquireRemote(
              existingProvenance.source === "ref" ? "ref" : "latest",
              existingProvenance.source === "ref" ? existingProvenance.ref : "",
            );
    } else if (fromArg) {
      resolvedSource = acquireLocal(fromArg);
    } else if (refArg) {
      resolvedSource = await acquireRemote("ref", refArg);
    } else if (tagArg) {
      resolvedSource = await acquireRemote("tag", tagArg);
    } else if (skipBuild) {
      // Development-only compatibility: --skip-build intentionally consumes the
      // already-built projection beside this script and never performs network I/O.
      const localPluginRoot = dirname(import.meta.dir);
      resolvedSource = {
        pluginRoot: localPluginRoot,
        source: "local",
        ref: dirname(localPluginRoot),
        requestedTag: null,
        cleanupRoot: null,
      };
    } else {
      resolvedSource = await acquireRemote("latest", "");
    }
  } catch (error) {
    fail(`source acquisition failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const pluginRoot = resolvedSource.pluginRoot;
  const cleanupRoot = resolvedSource.cleanupRoot;
  if (cleanupRoot !== null) {
    process.on("exit", () => rmSync(cleanupRoot, { recursive: true, force: true }));
  }
  let pluginVersion = "";
  try {
    pluginVersion = validateManifest(resolvedSource).version;
  } catch (error) {
    fail(`source validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // ---- build ------------------------------------------------------------------

  const distDir = join(pluginRoot, "dist", harness);
  if (skipBuild) {
    if (!existsSync(distDir)) fail(`--skip-build but ${distDir} does not exist`);
  } else {
    run(`build dist/${harness}/`, ["bun", builderPath, pluginRoot, harness]);
  }

  // ---- dry run ----------------------------------------------------------------

  if (dryRun) {
    run("compose dry-run (target is not modified)", [
      "bun",
      pluginTestPath,
      pluginRoot,
      "--install",
      projectDir,
      "--harness",
      harness,
    ]);
    console.log("\n✓ dry run passed — rerun without --dry-run to install");
    process.exit(0);
  }

  // ---- upgrade refresh --------------------------------------------------------
  // The compose hook copies payload files no-clobber: new files land, but a
  // file that already exists in the harness tree is never overwritten. That is
  // the right default for a user-owned tree — and the wrong one for a plugin
  // UPGRADE, where it leaves the previous version's schema and tools coexisting
  // with the new version's files. The skew is not hypothetical: a newly added
  // sensor loading a stale findings schema self-validates against the old
  // contract and degrades every document it writes to `unavailable`. Before
  // composing, remove the plugin's OWN payload files from the harness tree so
  // compose re-places the current versions. Only files this plugin's projection
  // ships are touched; contribution merges into core stages are content-based
  // and refresh themselves.

  const PAYLOAD_MAP: [string, string[]][] = [
    ["sensors", ["sensors"]],
    ["tools", ["tools"]],
    ["knowledge", ["knowledge"]],
    ["agents", ["agents"]],
    ["scopes", ["scopes"]],
    ["stages", ["aidlc-common", "stages"]],
  ];

  function walkFiles(root: string): string[] {
    const out: string[] = [];
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) visit(p);
        else out.push(relative(root, p));
      }
    };
    visit(root);
    return out.sort();
  }

  function payloadDigest(entries: readonly { path: string; bytes: Uint8Array }[]): string {
    return canonicalPayloadSha256(entries);
  }

  function candidatePayloadEntries(): { path: string; bytes: Uint8Array }[] {
    const entries: { path: string; bytes: Uint8Array }[] = [];
    for (const [srcDir, dstParts] of PAYLOAD_MAP) {
      const srcRoot = join(distDir, srcDir);
      if (!existsSync(srcRoot)) continue;
      for (const rel of walkFiles(srcRoot)) {
        const source = join(srcRoot, rel);
        if (lstatSync(source).isSymbolicLink()) continue;
        entries.push({
          path: [...dstParts, ...rel.split(sep)].join("/"),
          // Compose materializes harness placeholders in Markdown payloads. Hash
          // the bytes that will exist in the destination, not the projection
          // template bytes, so an unchanged source can be recognized pre-write.
          bytes: Buffer.from(readFileSync(source, "utf-8").replaceAll("{{HARNESS_DIR}}", target.harnessLeaf), "utf-8"),
        });
      }
    }
    return entries;
  }

  function installedPayloadEntries(): { path: string; bytes: Uint8Array }[] | null {
    const entries: { path: string; bytes: Uint8Array }[] = [];
    for (const candidate of candidatePayloadEntries()) {
      if (candidate.path === `tools/data/${PROVENANCE_FILE}`) continue;
      const installed = join(projectDir, target.harnessLeaf, ...candidate.path.split("/"));
      if (!existsSync(installed) || !lstatSync(installed).isFile() || lstatSync(installed).isSymbolicLink())
        return null;
      entries.push({ path: candidate.path, bytes: readFileSync(installed) });
    }
    return entries;
  }

  function sameResolvedSource(provenance: InstallationProvenance): boolean {
    return provenance.source === resolvedSource.source && provenance.ref === resolvedSource.ref;
  }

  function writeProvenance(payloadSha256: string): void {
    const provenance: InstallationProvenance = {
      version: pluginVersion,
      ref: resolvedSource.ref,
      source: resolvedSource.source,
      installed_at: new Date().toISOString(),
      payload_sha256: payloadSha256,
    };
    mkdirSync(dirname(provenancePath), { recursive: true });
    const temporary = `${provenancePath}.tmp-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(temporary, `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
      renameSync(temporary, provenancePath);
    } finally {
      rmSync(temporary, { force: true });
    }
  }

  function refreshPluginPayloads(): number {
    let refreshed = 0;
    for (const [srcDir, dstParts] of PAYLOAD_MAP) {
      const srcRoot = join(distDir, srcDir);
      if (!existsSync(srcRoot)) continue;
      for (const rel of walkFiles(srcRoot)) {
        const dst = join(projectDir, target.harnessLeaf, ...dstParts, rel);
        if (existsSync(dst)) {
          rmSync(dst, { force: true });
          refreshed += 1;
        }
      }
    }
    return refreshed;
  }

  // 廃止済みペイロードの tombstone: かつて配布し、もう dist に存在しないファイル
  // またはディレクトリ。compose は no-clobber・refresh は「現 dist に在るもの」
  // しか消せないため、ここに載せない限りアップグレード先へ孤児として残り続ける。
  // 後方互換の残骸を残さない——何かを廃止したら同じ変更でこのリストに追記すること。
  interface RemovedPayload {
    readonly parts: readonly string[];
    // "directory" は中身ごと消す（層ツリーのように再帰的に廃止されたもの）。
    readonly kind: "file" | "directory";
  }

  const file = (...parts: string[]): RemovedPayload => ({ parts, kind: "file" });
  const directory = (...parts: string[]): RemovedPayload => ({ parts, kind: "directory" });

  const REMOVED_PAYLOADS: readonly RemovedPayload[] = [
    file("tools", "deep-spec-lib.ts"), // DDD 移行 PR2a で refcheck/ と kernel/ へ解体
    file("tools", "deep-spec-design-lib.ts"), // DDD 移行 PR5 で design/ へ解体
    file("tools", "deep-spec-refinement-lib.ts"), // DDD 移行 PR6 で refinement/ と design/ へ解体
    file("tools", "design", "domain", "design-temporal-decl.ts"), // TDA 波3 で DesignObligationDeclaration の構築口へ解散
    // src/bundle 分離: entry は tools/<name>.ts の bundle 済み単一ファイルになり、
    // 層ツリーは配布物から消えた（ソースは src/ にしか無い）。entry のファイル名は
    // 変わらないので旧版の entry は upgrade refresh が現行版へ置き換える——tombstone
    // が要るのは、二度と配布されない層ディレクトリだけ。
    directory("tools", "kernel"),
    directory("tools", "requirements"),
    directory("tools", "design"),
    directory("tools", "refinement"),
    directory("tools", "refcheck"),
    directory("tools", "doctor"),
  ];

  const beforePayload = installedPayloadEntries();
  const candidateDigest = payloadDigest(candidatePayloadEntries());
  const hasTombstonedPayload = REMOVED_PAYLOADS.some((payload) =>
    existsSync(join(projectDir, target.harnessLeaf, ...payload.parts)),
  );
  if (
    existingProvenance &&
    sameResolvedSource(existingProvenance) &&
    existingProvenance.version === pluginVersion &&
    beforePayload &&
    !hasTombstonedPayload &&
    payloadDigest(beforePayload) === candidateDigest &&
    existingProvenance.payload_sha256 === candidateDigest
  ) {
    console.log(`Changed 0 — ${resolvedSource.source} ${resolvedSource.ref} is already installed`);
    process.exit(0);
  }

  function removeTombstonedPayloads(): number {
    let removed = 0;
    for (const payload of REMOVED_PAYLOADS) {
      const dst = join(projectDir, target.harnessLeaf, ...payload.parts);
      if (!existsSync(dst)) continue;
      try {
        rmSync(dst, { force: true, recursive: payload.kind === "directory" });
      } catch (error) {
        // 消せない孤児を黙って見逃すと、次のセンサー発火が古い実装を掴む。
        fail(`cannot remove retired payload ${dst}: ${error instanceof Error ? error.message : String(error)}`);
      }
      removed += 1;
    }
    return removed;
  }

  const refreshed = refreshPluginPayloads();
  if (refreshed > 0) {
    console.log(
      `\n▸ upgrade refresh: removed ${refreshed} previously composed plugin file(s) so compose re-places the current versions`,
    );
  }
  const tombstoned = removeTombstonedPayloads();
  if (tombstoned > 0) {
    console.log(`\n▸ upgrade cleanup: removed ${tombstoned} retired plugin file(s) that this version no longer ships`);
  }

  // ---- drop (storeless harnesses only) + compose ------------------------------

  if (target.kind === "store") {
    console.log(
      `\n▸ ${harness} is a store harness — composing directly from dist/, nothing is copied into the project`,
    );
  } else {
    console.log(`\n▸ copy ${distDir} → ${projectDir} (folder-drop, ${target.kind} layout)`);
    cpSync(distDir, projectDir, { recursive: true });
  }

  const composeEnv = {
    AIDLC_PLUGIN_ROOT: distDir,
    AIDLC_PROJECT_DIR: projectDir,
    AIDLC_HARNESS_DIR: target.harnessLeaf,
    AIDLC_HARNESS_NAME: target.harnessName,
  };
  const aidlcBin = Bun.which("aidlc");
  if (aidlcBin) {
    run("compose (aidlc plugin sync)", [aidlcBin, "plugin", "sync"], {
      cwd: projectDir,
      env: composeEnv,
    });
  } else {
    run("compose (hooks/compose.ts)", ["bun", join(distDir, "hooks", "compose.ts")], {
      cwd: projectDir,
      env: composeEnv,
    });
  }

  // ---- verify -----------------------------------------------------------------

  const sentinel = join(projectDir, target.harnessLeaf, "sensors", "aidlc-deep-spec-ir-valid.md");
  if (!existsSync(sentinel)) {
    fail(`compose finished but ${sentinel} is missing — check the compose output above`);
  }
  console.log(
    `\n✓ installed into ${projectDir} (${target.harnessLeaf}/) — ` +
      "the deep-spec-analysis-verify stage is now part of Inception.\n" +
      "  Next: run /aidlc --doctor in that project to check solver availability.",
  );

  // Late-adoption safety net: immediately surface every existing intent whose
  // requirements the plugin can verify but has not — instead of leaving that
  // discovery to human attention. The installed doctor owns the scan; render
  // its verification-coverage rows here.
  const doctor = spawnSync("bun", [join(projectDir, target.harnessLeaf, "tools", "deep-spec-analysis-doctor.ts")], {
    encoding: "utf-8",
    timeout: 60_000,
    cwd: projectDir,
    env: {
      ...process.env,
      AIDLC_PROJECT_DIR: projectDir,
      AIDLC_HARNESS_DIR: target.harnessLeaf,
    },
  });
  if (doctor.status !== 0) {
    fail(`doctor coverage scan failed — run /aidlc --doctor manually (${doctor.stderr || doctor.stdout})`);
  }
  try {
    const rows: { pass: boolean; label: string; fix?: string }[] = JSON.parse(doctor.stdout).checks;
    const debt = rows.filter(
      (c) =>
        !c.pass &&
        (c.label.includes("no deep-spec verification") || c.label.includes("after the last deep-spec verification")),
    );
    if (debt.length > 0) {
      console.log("\n⚠ Existing intents with unverified requirements:");
      for (const row of debt) {
        console.log(`  - ${row.label}`);
        if (row.fix) console.log(`    → ${row.fix}`);
      }
    } else {
      const summary = rows.find((c) => c.label.includes("verification coverage"));
      if (summary) console.log(`\n${summary.label}`);
    }
  } catch (error) {
    fail(`could not parse the doctor's coverage report: ${error instanceof Error ? error.message : String(error)}`);
  }

  const installedPayload = installedPayloadEntries();
  if (!installedPayload) fail("compose completed but one or more plugin-owned payload files are missing");
  const installedDigest = payloadDigest(installedPayload);
  writeProvenance(installedDigest);
  console.log(`Changed 1 — recorded ${pluginVersion} from ${resolvedSource.source} ${resolvedSource.ref}`);
}
