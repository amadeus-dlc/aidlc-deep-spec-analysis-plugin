import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  acquireLocal,
  acquireRemote,
  canonicalPayloadSha256,
  extractTarGz,
  latestStableTag,
  parseStableSemver,
  selectSourceSelector,
  validateManifest,
} from "../scripts/install.ts";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "deep-spec-installer-test-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tarGz(entries: readonly { name: string; bytes: Uint8Array; type?: string }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const header = new Uint8Array(512);
    header.set(encoder.encode(entry.name), 0);
    header.set(encoder.encode("0000777\0"), 100);
    header.set(encoder.encode("0000000\0"), 108);
    header.set(encoder.encode("0000000\0"), 116);
    header.set(encoder.encode(entry.bytes.length.toString(8).padStart(11, "0") + "\0"), 124);
    header.set(encoder.encode("00000000000\0"), 136);
    header.fill(32, 148, 156);
    header[156] = (entry.type ?? "0").charCodeAt(0);
    header.set(encoder.encode("ustar\0"), 257);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.set(encoder.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
    chunks.push(header, entry.bytes);
    const padding = (512 - (entry.bytes.length % 512)) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const tar = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    tar.set(chunk, offset);
    offset += chunk.length;
  }
  return Bun.gzipSync(tar.slice().buffer as ArrayBuffer);
}

describe("installer source selection", () => {
  test("uses --from > --ref > --tag > latest precedence", () => {
    expect(selectSourceSelector({ from: "/repo", ref: "main", tag: "v1.0.0" })).toEqual({ kind: "local", value: "/repo" });
    expect(selectSourceSelector({ ref: "main", tag: "v1.0.0" })).toEqual({ kind: "ref", value: "main" });
    expect(selectSourceSelector({ tag: "v1.0.0" })).toEqual({ kind: "tag", value: "v1.0.0" });
    expect(selectSourceSelector({})).toEqual({ kind: "latest", value: "" });
  });

  test("selects the greatest stable Semantic Version tag", () => {
    expect(parseStableSemver("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseStableSemver("v1.2.3-rc.1")).toBeNull();
    expect(latestStableTag(["v0.9.0", "v2.0.0-rc.1", "v1.10.0", "not-a-version"])).toBe("v1.10.0");
    expect(latestStableTag(["v1.0.0-beta.1"])).toBeNull();
  });

  test("accepts only a repository root containing deep-spec-analysis", () => {
    const repo = temporaryRoot();
    const plugin = join(repo, "deep-spec-analysis");
    mkdirSync(join(plugin, ".aidlc-plugin"), { recursive: true });
    writeFileSync(join(plugin, ".aidlc-plugin", "plugin.json"), "{}\n");
    expect(acquireLocal(repo).pluginRoot).toBe(plugin);
    expect(() => acquireLocal(plugin)).toThrow("plugin root itself was provided");
  });

  test("fails before touching the destination when the AI-DLC builder is missing", () => {
    const project = temporaryRoot();
    const repo = temporaryRoot();
    const plugin = join(repo, "deep-spec-analysis");
    mkdirSync(join(project, ".claude"), { recursive: true });
    mkdirSync(join(plugin, ".aidlc-plugin"), { recursive: true });
    writeFileSync(join(plugin, ".aidlc-plugin", "plugin.json"), '{"name":"deep-spec-analysis","version":"0.5.0"}\n');
    const sentinel = join(project, ".claude", "sentinel.txt");
    writeFileSync(sentinel, "unchanged\n");

    const result = spawnSync("bun", [join(import.meta.dir, "..", "scripts", "install.ts"), "--project", project, "--from", repo], {
      encoding: "utf-8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AI-DLC plugin toolchain is missing");
    expect(readFileSync(sentinel, "utf-8")).toBe("unchanged\n");
  });

  test("resolves latest through the tags API and downloads the matching public archive", async () => {
    const manifest = new TextEncoder().encode('{"name":"deep-spec-analysis","version":"1.10.0"}\n');
    const archive = tarGz([{ name: "repo-v1.10.0/deep-spec-analysis/.aidlc-plugin/plugin.json", bytes: manifest }]);
    const calls: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("api.github.com")) {
        return new Response(JSON.stringify([{ name: "v1.0.0" }, { name: "v1.10.0" }, { name: "v2.0.0-rc.1" }]), { status: 200 });
      }
      return new Response(archive, { status: 200 });
    });

    const source = await acquireRemote("latest", "", fetcher);
    if (source.cleanupRoot) temporaryRoots.push(source.cleanupRoot);
    expect(source.source).toBe("latest");
    expect(source.ref).toBe("v1.10.0");
    expect(validateManifest(source).version).toBe("1.10.0");
    expect(calls.some((url) => url.endsWith("/refs/tags/v1.10.0"))).toBe(true);
  });

  test("rejects a tag whose version differs from the manifest", async () => {
    const archive = tarGz([{
      name: "repo-v1.0.0/deep-spec-analysis/.aidlc-plugin/plugin.json",
      bytes: new TextEncoder().encode('{"name":"deep-spec-analysis","version":"1.1.0"}\n'),
    }]);
    const fetcher = async () => new Response(archive, { status: 200 });
    const source = await acquireRemote("tag", "v1.0.0", fetcher);
    if (source.cleanupRoot) temporaryRoots.push(source.cleanupRoot);
    expect(() => validateManifest(source)).toThrow("does not match manifest version");
  });
});

describe("installer archive and provenance integrity", () => {
  test("extracts regular files below the destination", () => {
    const destination = temporaryRoot();
    const payload = new TextEncoder().encode('{"name":"deep-spec-analysis","version":"0.5.0"}\n');
    extractTarGz(tarGz([{ name: "repo-rev/deep-spec-analysis/.aidlc-plugin/plugin.json", bytes: payload }]), destination);
    const manifest = join(destination, "repo-rev", "deep-spec-analysis", ".aidlc-plugin", "plugin.json");
    expect(readFileSync(manifest, "utf-8")).toContain("deep-spec-analysis");
  });

  test("rejects path traversal and archive links", () => {
    const destination = temporaryRoot();
    expect(() => extractTarGz(tarGz([{ name: "../escaped", bytes: new Uint8Array() }]), destination)).toThrow("unsafe archive path");
    expect(existsSync(join(destination, "..", "escaped"))).toBe(false);
    expect(() => extractTarGz(tarGz([{ name: "repo/link", bytes: new Uint8Array(), type: "2" }]), destination)).toThrow("archive links are not allowed");
  });

  test("hashes path and content bytes in byte-sorted order", () => {
    const a = { path: "tools/a.ts", bytes: new TextEncoder().encode("a") };
    const b = { path: "tools/b.ts", bytes: new TextEncoder().encode("b") };
    expect(canonicalPayloadSha256([b, a])).toBe(canonicalPayloadSha256([a, b]));
    expect(canonicalPayloadSha256([a, b])).not.toBe(
      canonicalPayloadSha256([a, { ...b, bytes: new TextEncoder().encode("B") }]),
    );
    expect(canonicalPayloadSha256([a, b])).not.toBe(
      canonicalPayloadSha256([a, { ...b, path: "tools/c.ts" }]),
    );
  });
});
