import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertTagMatchesManifest, type GitResult, type GitRunner, release } from "../scripts/release";

const sandboxes: string[] = [];

function fixture(version = "0.5.0"): { repoRoot: string; manifestPath: string; original: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), "deep-spec-release-"));
  sandboxes.push(repoRoot);
  const manifestPath = join(repoRoot, "deep-spec-analysis", ".aidlc-plugin", "plugin.json");
  mkdirSync(join(repoRoot, "deep-spec-analysis", ".aidlc-plugin"), { recursive: true });
  const original = `${JSON.stringify({ name: "deep-spec-analysis", version, description: "fixture" }, null, 2)}\n`;
  writeFileSync(manifestPath, original);
  return { repoRoot, manifestPath, original };
}

function result(status: number, stdout = "", stderr = ""): GitResult {
  return { status, stdout, stderr };
}

function scriptedRunner(overrides: Readonly<Record<string, GitResult>> = {}): {
  readonly calls: string[][];
  readonly runner: GitRunner;
} {
  const calls: string[][] = [];
  return {
    calls,
    runner: (args) => {
      const call = [...args];
      calls.push(call);
      const key = call.join(" ");
      if (overrides[key]) return overrides[key];
      if (key === "branch --show-current") return result(0, "main\n");
      if (key === "status --porcelain") return result(0);
      if (key.startsWith("show-ref ")) return result(1);
      if (key.startsWith("ls-remote ")) return result(2);
      return result(0);
    },
  };
}

function mutationCalls(calls: readonly string[][]): string[][] {
  return calls.filter(([command]) => ["add", "commit", "tag", "push"].includes(command));
}

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) rmSync(sandbox, { recursive: true, force: true });
});

describe("release preflight", () => {
  test("rejects an unstable or v-prefixed version without running git or changing the manifest", () => {
    const { repoRoot, manifestPath, original } = fixture();
    const { calls, runner } = scriptedRunner();

    expect(() => release("v1.2.3", { repoRoot, manifestPath, runGit: runner })).toThrow("without a v prefix");
    expect(calls).toEqual([]);
    expect(readFileSync(manifestPath, "utf-8")).toBe(original);
  });

  test("rejects a non-main branch before any mutation", () => {
    const { repoRoot, manifestPath, original } = fixture();
    const { calls, runner } = scriptedRunner({ "branch --show-current": result(0, "feature/release\n") });

    expect(() => release("1.2.3", { repoRoot, manifestPath, runGit: runner })).toThrow("must run on main");
    expect(mutationCalls(calls)).toEqual([]);
    expect(readFileSync(manifestPath, "utf-8")).toBe(original);
  });

  test("rejects a dirty worktree before any mutation", () => {
    const { repoRoot, manifestPath, original } = fixture();
    const { calls, runner } = scriptedRunner({ "status --porcelain": result(0, " M README.md\n") });

    expect(() => release("1.2.3", { repoRoot, manifestPath, runGit: runner })).toThrow("clean working tree");
    expect(mutationCalls(calls)).toEqual([]);
    expect(readFileSync(manifestPath, "utf-8")).toBe(original);
  });

  test("rejects an existing local tag before any mutation", () => {
    const { repoRoot, manifestPath, original } = fixture();
    const localTag = "show-ref --verify --quiet refs/tags/v1.2.3";
    const { calls, runner } = scriptedRunner({ [localTag]: result(0) });

    expect(() => release("1.2.3", { repoRoot, manifestPath, runGit: runner })).toThrow(
      "local tag v1.2.3 already exists",
    );
    expect(mutationCalls(calls)).toEqual([]);
    expect(readFileSync(manifestPath, "utf-8")).toBe(original);
  });

  test("rejects an existing remote tag before any mutation", () => {
    const { repoRoot, manifestPath, original } = fixture();
    const remoteTag = "ls-remote --exit-code --tags origin refs/tags/v1.2.3";
    const { calls, runner } = scriptedRunner({ [remoteTag]: result(0, "deadbeef\trefs/tags/v1.2.3\n") });

    expect(() => release("1.2.3", { repoRoot, manifestPath, runGit: runner })).toThrow(
      "remote tag v1.2.3 already exists",
    );
    expect(mutationCalls(calls)).toEqual([]);
    expect(readFileSync(manifestPath, "utf-8")).toBe(original);
  });
});

describe("release mutation", () => {
  test("updates the manifest, commits in English, tags, and atomically pushes main plus the tag", () => {
    const { repoRoot, manifestPath } = fixture();
    const { calls, runner } = scriptedRunner();

    release("1.2.3", { repoRoot, manifestPath, runGit: runner });

    expect(JSON.parse(readFileSync(manifestPath, "utf-8"))).toEqual({
      name: "deep-spec-analysis",
      version: "1.2.3",
      description: "fixture",
    });
    expect(mutationCalls(calls)).toEqual([
      ["add", "--", "deep-spec-analysis/.aidlc-plugin/plugin.json"],
      ["commit", "--allow-empty", "-m", "chore(release): publish v1.2.3"],
      ["tag", "v1.2.3"],
      ["push", "--atomic", "origin", "main", "v1.2.3"],
    ]);
  });

  test("creates the first release commit when the manifest already contains the baseline version", () => {
    const { repoRoot, manifestPath } = fixture("0.5.0");
    const { calls, runner } = scriptedRunner();

    release("0.5.0", { repoRoot, manifestPath, runGit: runner });

    expect(mutationCalls(calls)).toContainEqual(["commit", "--allow-empty", "-m", "chore(release): publish v0.5.0"]);
    expect(mutationCalls(calls).at(-1)).toEqual(["push", "--atomic", "origin", "main", "v0.5.0"]);
  });
});

describe("release tag consistency", () => {
  test("accepts a release tag matching the manifest", () => {
    const { manifestPath } = fixture("1.2.3");
    expect(() => assertTagMatchesManifest("v1.2.3", manifestPath)).not.toThrow();
  });

  test("rejects a release tag that differs from the manifest", () => {
    const { manifestPath } = fixture("1.2.3");
    expect(() => assertTagMatchesManifest("v1.2.4", manifestPath)).toThrow(
      "release tag v1.2.4 does not match plugin manifest version 1.2.3",
    );
  });
});
