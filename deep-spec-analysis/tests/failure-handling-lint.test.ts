import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { lintFailureHandling } from "../scripts/lint/failure-handling.ts";

const roots: string[] = [];
const typeRoots = resolve(import.meta.dir, "../node_modules/@types");

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "failure-handling-lint-"));
  roots.push(root);
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        allowImportingTsExtensions: true,
        typeRoots: [typeRoots],
        types: ["bun"],
      },
      include: ["src/**/*.ts"],
    }),
  );
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return join(root, "tsconfig.json");
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const resultInfrastructure = `
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
export function matchResult<T, E, U>(result: Result<T, E>, cases: { ok: (value: T) => U; err: (error: E) => U }): U {
  return result.ok ? cases.ok(result.value) : cases.err(result.error);
}
`;

const repositoryTypes = `
export type RepositoryError = { kind: "not-found" } | { kind: "io-failed" };
`;

test("structured process JSON, ENOENT rethrow, write existence and domain-only errors are clean", async () => {
  const config = project({
    "src/kernel/infrastructure/result-composition.ts": resultInfrastructure,
    "src/kernel/usecase/repository-error.ts": repositoryTypes,
    "src/sample/adapter/clean.ts": `
      import * as child from "node:child_process";
      import { existsSync, readFileSync, rmSync } from "node:fs";
      import { matchResult } from "../../kernel/infrastructure/result-composition.ts";
      import type { Result } from "../../kernel/infrastructure/result-composition.ts";
      import type { RepositoryError } from "../../kernel/usecase/repository-error.ts";
      type DomainError = { kind: "not-applicable" };
      type DomainResult = { ok: true; value: string } | { ok: false; error: DomainError };
      declare const domain: { check(): DomainResult };
      declare const unavailableRepository: { findById(): Result<string, RepositoryError> };
      export function verify(): boolean {
        const run = child.spawnSync("tool", [], { encoding: "utf8" });
        const document = JSON.parse(String(run.stdout)) as { status?: string };
        const state = "deadlock";
        if (state.includes("deadlock")) return false;
        if (String("domain").includes("error")) return false;
        return document.status === "violation";
      }
      export function load(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          const code = error instanceof Error && "code" in error ? error.code : undefined;
          if (code === "ENOENT") return null;
          throw error;
        }
      }
      export function publish(path: string): boolean {
        if (existsSync(path)) { child.spawnSync("rename", [path]); }
        return true;
      }
      export function unavailable(path: string): { kind: "unavailable" } {
        try { readFileSync(path, "utf8"); }
        catch { return { kind: "unavailable" }; }
        return { kind: "unavailable" };
      }
      export function domainOnly() {
        return matchResult(domain.check(), { err: () => ({ kind: "not-applicable" as const }), ok: () => ({ kind: "not-applicable" as const }) });
      }
      export function preserveUnavailable() {
        return matchResult(unavailableRepository.findById(), { err: () => ({ kind: "unavailable" as const }), ok: () => ({ kind: "unavailable" as const }) });
      }
      export function guardedNotFound() {
        return matchResult(unavailableRepository.findById(), {
          err: (error) => error.kind === "not-found" ? ({ kind: "not-applicable" as const }) : ({ kind: "acquisition-failed" as const, error }),
          ok: () => ({ kind: "acquisition-failed" as const, error: { kind: "io-failed" as const } }),
        });
      }
    `,
  });
  const result = await lintFailureHandling(config);
  expect(result.checkedFiles).toBe(2);
  expect(result.diagnostics).toEqual([]);
});

test("process aliases and regex, filesystem catch, existence gate, and repository errors are reported", async () => {
  const config = project({
    "src/kernel/infrastructure/result-composition.ts": resultInfrastructure,
    "src/kernel/usecase/repository-error.ts": repositoryTypes,
    "src/sample/adapter/process.ts": `
      import * as child from "node:child_process";
      import { readFileSync as load, existsSync, rmSync } from "node:fs";
      const run = child.spawnSync;
      const marker = "deadlock";
      export function verify(path: string): boolean {
        const { stdout: output } = run("tool", [], { encoding: "utf8" });
        const regex = /error|violation/i;
        return output.toLowerCase().includes(marker) || regex.test(output);
      }
      export function conditional(flag: boolean): boolean {
        const run = child.spawnSync("tool", [], { encoding: "utf8" });
        const output = flag ? "ordinary domain text" : run.stdout;
        return output.includes("error");
      }
      export function loadMaybe(path: string): string | null {
        try { return load(path, "utf8") as string; }
        catch { return null; }
      }
      export function probeMaybe(path: string): string | null {
        try { return load(path, "utf8") as string; }
        catch { return null; }
      }
      export function existsGate(path: string): string | null {
        if (!existsSync(path)) return null;
        return path;
      }
      export function commentedGate(path: string): string | null {
        if (!existsSync(path)) { /* unavailable is only a comment */ return null; }
        return path;
      }
      export function cleanupGate(path: string): string | null {
        if (!existsSync(path)) { rmSync(path, { force: true }); return null; }
        return path;
      }
      export function optionalRead(path: string): string | null {
        let value: string | null = null;
        if (existsSync(path)) value = load(path, "utf8") as string;
        return value;
      }
      export function indexSearch(): boolean {
        const output = run("tool", [], { encoding: "utf8" }).stdout;
        return output.indexOf("fail") >= 0 || output.lastIndexOf("violation") >= 0;
      }
      type Acquisition = { kind: "unavailable" } | { kind: "value"; value: string } | null;
      export function conditionalGate(path: string, degraded: boolean): Acquisition {
        if (existsSync(path)) return { kind: "value", value: load(path, "utf8") as string };
        if (degraded) return { kind: "unavailable" };
        return null;
      }
    `,
    "src/sample/usecase/repository.ts": `
      import { matchResult as choose } from "../../kernel/infrastructure/result-composition.ts";
      import type { Result } from "../../kernel/infrastructure/result-composition.ts";
      import type { RepositoryError } from "../../kernel/usecase/repository-error.ts";
      declare const repository: { findById(): Result<string, RepositoryError> };
      declare const manualResult: Result<string, RepositoryError>;
      export const execute = () => choose(repository.findById(), {
        err: () => ({ kind: "not-applicable" as const }),
        ok: () => ({ kind: "not-applicable" as const }),
      });
      export const aliased = () => choose(repository.findById(), {
        err: (error) => { const outcome = { kind: "not-applicable" as const }; console.log(error); return outcome; },
        ok: () => ({ kind: "not-applicable" as const }),
      });
      export const bothBranches = () => choose(repository.findById(), {
        err: (error) => error.kind === "not-found" ? ({ kind: "not-applicable" as const }) : ({ kind: "not-applicable" as const }),
        ok: () => ({ kind: "not-applicable" as const }),
      });
      export const manual = () => {
        const result = manualResult;
        if (!result.ok) return { kind: "not-applicable" as const };
        return { kind: "not-applicable" as const };
      };
    `,
  });
  const result = await lintFailureHandling(config);
  expect(result.diagnostics.map(({ rule, path, line, column }) => ({ rule, path, line, column }))).toEqual([
    { rule: "process-output-classification", path: "src/sample/adapter/process.ts", line: 9, column: 16 },
    { rule: "process-output-classification", path: "src/sample/adapter/process.ts", line: 9, column: 57 },
    { rule: "process-output-classification", path: "src/sample/adapter/process.ts", line: 14, column: 16 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/process.ts", line: 18, column: 9 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/process.ts", line: 22, column: 9 },
    { rule: "filesystem-existence-gate", path: "src/sample/adapter/process.ts", line: 25, column: 14 },
    { rule: "filesystem-existence-gate", path: "src/sample/adapter/process.ts", line: 29, column: 14 },
    { rule: "filesystem-existence-gate", path: "src/sample/adapter/process.ts", line: 33, column: 14 },
    { rule: "filesystem-existence-gate", path: "src/sample/adapter/process.ts", line: 38, column: 13 },
    { rule: "process-output-classification", path: "src/sample/adapter/process.ts", line: 43, column: 16 },
    { rule: "process-output-classification", path: "src/sample/adapter/process.ts", line: 43, column: 47 },
    { rule: "filesystem-existence-gate", path: "src/sample/adapter/process.ts", line: 47, column: 13 },
    { rule: "repository-error-collapse", path: "src/sample/usecase/repository.ts", line: 7, column: 36 },
    { rule: "repository-error-collapse", path: "src/sample/usecase/repository.ts", line: 11, column: 36 },
    { rule: "repository-error-collapse", path: "src/sample/usecase/repository.ts", line: 15, column: 41 },
    { rule: "repository-error-collapse", path: "src/sample/usecase/repository.ts", line: 21, column: 9 },
  ]);
});

test("an explicit ENOENT branch with a rethrow is allowed, while a non-ENOENT fallback is not", async () => {
  const config = project({
    "src/sample/adapter/read.ts": `
      import { readFileSync } from "node:fs";
      export function safe(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          const code = error instanceof Error && "code" in error ? error.code : undefined;
          if (code === "ENOENT") return null;
          throw error;
        }
      }
      export function unsafe(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          if (error instanceof Error && error.message.includes("ENOENT")) return null;
          return null;
        }
      }
      export function reversed(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          const code = error instanceof Error && "code" in error ? error.code : undefined;
          if (code === "ENOENT") throw error;
          return null;
        }
      }
      export function orUnsafe(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          const code = error instanceof Error && "code" in error ? error.code : undefined;
          if (code === "ENOENT" || error instanceof Error) return null;
          throw error;
        }
      }
      export function aliasAbsent(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch {
          const absent = null;
          return absent;
        }
      }
      export function priorGuard(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          const absent = null;
          const code = error instanceof Error && "code" in error ? error.code : undefined;
          if (code === "ENOENT") return null;
          return absent;
        }
      }
      export function unrelatedLabel(path: string): string | null {
        try { return readFileSync(path, "utf8") as string; }
        catch (error: unknown) {
          const label = "ENOENT";
          if (label === "ENOENT") return null;
          throw error;
        }
      }
    `,
  });
  const result = await lintFailureHandling(config);
  expect(result.diagnostics.map(({ rule, path, line, column }) => ({ rule, path, line, column }))).toEqual([
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/read.ts", line: 13, column: 9 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/read.ts", line: 20, column: 9 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/read.ts", line: 28, column: 9 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/read.ts", line: 36, column: 9 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/read.ts", line: 43, column: 9 },
    { rule: "filesystem-error-collapse", path: "src/sample/adapter/read.ts", line: 52, column: 9 },
  ]);
});

test("the CLI reports JSON, exits 1 for violations, and fails closed for bad or empty projects", () => {
  const cli = resolve(import.meta.dir, "../scripts/lint-failure-handling.ts");
  const invalid = project({
    "src/sample/adapter/bad.ts": `import { spawnSync } from "node:child_process"; export const bad = () => spawnSync("x", []).stdout.includes("error");`,
  });
  const failed = Bun.spawnSync(["bun", cli, "--project", invalid, "--json"]);
  expect(failed.exitCode).toBe(1);
  expect(JSON.parse(failed.stdout.toString()).diagnostics[0].rule).toBe("process-output-classification");
  const linkRoot = mkdtempSync(join(tmpdir(), "failure-handling-lint-link-"));
  roots.push(linkRoot);
  const linkedConfig = join(linkRoot, "tsconfig.json");
  symlinkSync(invalid, linkedConfig);
  const linkedRun = Bun.spawnSync(["bun", cli, "--project", linkedConfig, "--json"]);
  expect(linkedRun.exitCode).toBe(1);
  expect(JSON.parse(linkedRun.stdout.toString()).diagnostics[0].rule).toBe("process-output-classification");

  const syntax = project({ "src/sample/adapter/syntax.ts": "export function broken( {" });
  const syntaxRun = Bun.spawnSync(["bun", cli, "--project", syntax, "--json"]);
  expect(syntaxRun.exitCode).toBe(2);
  expect(syntaxRun.stderr.toString()).toContain("TypeScript source has");
  const type = project({ "src/sample/adapter/type.ts": "export const value: string = 1;" });
  const typeRun = Bun.spawnSync(["bun", cli, "--project", type, "--json"]);
  expect(typeRun.exitCode).toBe(2);
  expect(typeRun.stderr.toString()).toContain("TypeScript source has");

  const empty = project({ "src/sample/domain/empty.ts": "export const value = 1;" });
  const noTargets = Bun.spawnSync(["bun", cli, "--project", empty, "--json"]);
  expect(noTargets.exitCode).toBe(2);
  expect(noTargets.stderr.toString()).toContain("No adapter/usecase/entry source files found");
  expect(Bun.spawnSync(["bun", cli, "--project"]).exitCode).toBe(2);
});
