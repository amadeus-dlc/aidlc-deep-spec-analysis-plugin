import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  type FailureHandlingDiagnostic,
  type FailureHandlingLintReport,
  lintFailureHandling,
} from "../scripts/lint/failure-handling.ts";

const roots: string[] = [];
const typeRoots = resolve(import.meta.dir, "../node_modules/@types");

const COMMON_FILES = {
  "src/kernel/infrastructure/result-composition.ts": `
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
export function matchResult<T, E, U>(result: Result<T, E>, cases: { ok: (value: T) => U; err: (error: E) => U }): U {
  return result.ok ? cases.ok(result.value) : cases.err(result.error);
}
`,
  "src/kernel/usecase/repository-error.ts":
    'export type RepositoryError = { kind: "not-found" } | { kind: "io-failed" };\n',
} as const;

function project(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "failure-handling-regressions-"));
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
  for (const [path, content] of Object.entries({ ...COMMON_FILES, ...files })) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return join(root, "tsconfig.json");
}

async function lintPair(
  unsafeFiles: Readonly<Record<string, string>>,
  safeFiles: Readonly<Record<string, string>>,
): Promise<readonly [FailureHandlingLintReport, FailureHandlingLintReport]> {
  const unsafeConfig = project(unsafeFiles);
  const safeConfig = project(safeFiles);
  return Promise.all([lintFailureHandling(unsafeConfig), lintFailureHandling(safeConfig)]);
}

function assertRule(report: FailureHandlingLintReport, rule: FailureHandlingDiagnostic["rule"]): void {
  expect(report.diagnostics.some((diagnostic) => diagnostic.rule === rule)).toBe(true);
}

function assertClean(report: FailureHandlingLintReport): void {
  expect(report.diagnostics).toEqual([]);
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("an existence gate cannot hide a fallback through a local alias", async () => {
  const [unsafe, safe] = await lintPair(
    {
      "src/sample/adapter/case.ts": `import { existsSync } from "node:fs";
const absent: string | null = null;
export function read(path: string): string | null {
  if (!existsSync(path)) return absent;
  return path;
}
`,
    },
    {
      "src/sample/adapter/case.ts": `import { existsSync } from "node:fs";
type Outcome = { kind: "value"; value: string } | { kind: "unavailable" };
export function read(path: string): Outcome {
  if (!existsSync(path)) return { kind: "unavailable" };
  return { kind: "value", value: path };
}
`,
    },
  );

  assertRule(unsafe, "filesystem-existence-gate");
  assertClean(safe);
});

test("a conditional repository error callback cannot collapse both branches", async () => {
  const unsafeSource = `import { matchResult } from "../../kernel/infrastructure/result-composition.ts";
import type { Result } from "../../kernel/infrastructure/result-composition.ts";
import type { RepositoryError } from "../../kernel/usecase/repository-error.ts";
declare const repository: { findById(): Result<string, RepositoryError> };
export const read = () => matchResult(repository.findById(), {
  err: (error) => error.kind === "not-found"
    ? { kind: "not-applicable" as const }
    : { kind: "not-applicable" as const },
  ok: () => ({ kind: "not-applicable" as const }),
});
`;
  const safeSource = `import { matchResult } from "../../kernel/infrastructure/result-composition.ts";
import type { Result } from "../../kernel/infrastructure/result-composition.ts";
import type { RepositoryError } from "../../kernel/usecase/repository-error.ts";
declare const repository: { findById(): Result<string, RepositoryError> };
export const read = () => matchResult(repository.findById(), {
  err: (error) => error.kind === "not-found"
    ? { kind: "not-applicable" as const }
    : { kind: "acquisition-failed" as const, error },
  ok: () => ({ kind: "acquisition-failed" as const, error: { kind: "io-failed" as const } }),
});
`;
  const [unsafe, safe] = await lintPair(
    { "src/sample/usecase/case.ts": unsafeSource },
    { "src/sample/usecase/case.ts": safeSource },
  );

  assertRule(unsafe, "repository-error-collapse");
  assertClean(safe);
});

test("a catch fallback before an ENOENT guard cannot exempt the whole catch", async () => {
  const unsafeSource = `import { readFileSync } from "node:fs";
declare function shouldFallback(): boolean;
export function read(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (error: unknown) {
    if (shouldFallback()) return null;
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
    return null;
  }
}
`;
  const safeSource = `import { readFileSync } from "node:fs";
export function read(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (error: unknown) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return null;
    throw error;
  }
}
`;
  const [unsafe, safe] = await lintPair(
    { "src/sample/adapter/case.ts": unsafeSource },
    { "src/sample/adapter/case.ts": safeSource },
  );

  assertRule(unsafe, "filesystem-error-collapse");
  assertClean(safe);
});

test("an ENOENT-looking label unrelated to caught code cannot whitelist a fallback", async () => {
  const unsafeSource = `import { readFileSync } from "node:fs";
export function read(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (error: unknown) {
    const label = error instanceof Error ? error.name : "";
    if (label === "ENOENT") return null;
    throw error;
  }
}
`;
  const safeSource = `import { readFileSync } from "node:fs";
export function read(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (error: unknown) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return null;
    throw error;
  }
}
`;
  const [unsafe, safe] = await lintPair(
    { "src/sample/adapter/case.ts": unsafeSource },
    { "src/sample/adapter/case.ts": safeSource },
  );

  assertRule(unsafe, "filesystem-error-collapse");
  assertClean(safe);
});

test("a manual RepositoryError branch cannot turn failure into an empty success", async () => {
  const unsafeSource = `import type { Result } from "../../kernel/infrastructure/result-composition.ts";
import type { RepositoryError } from "../../kernel/usecase/repository-error.ts";
declare const repository: { findById(): Result<string, RepositoryError> };
export function read(): Result<string[], RepositoryError> {
  const result = repository.findById();
  if (!result.ok) return { ok: true, value: [] };
  return { ok: true, value: [result.value] };
}
`;
  const safeSource = `import type { Result } from "../../kernel/infrastructure/result-composition.ts";
import type { RepositoryError } from "../../kernel/usecase/repository-error.ts";
declare const repository: { findById(): Result<string, RepositoryError> };
export function read(): Result<string[], RepositoryError> {
  const result = repository.findById();
  if (!result.ok) {
    if (result.error.kind === "not-found") return { ok: true, value: [] };
    return { ok: false, error: result.error };
  }
  return { ok: true, value: [result.value] };
}
`;
  const [unsafe, safe] = await lintPair(
    { "src/sample/usecase/case.ts": unsafeSource },
    { "src/sample/usecase/case.ts": safeSource },
  );

  assertRule(unsafe, "repository-error-collapse");
  assertClean(safe);
});

test("a conditional unavailable branch cannot exempt a later default success", async () => {
  const unsafeSource = `import { existsSync, readFileSync } from "node:fs";
type Outcome = { kind: "verdict"; value: string } | { kind: "unavailable" };
export function read(path: string, allowSkip: boolean): Outcome {
  if (existsSync(path)) return { kind: "verdict", value: readFileSync(path, "utf8") };
  if (allowSkip) return { kind: "unavailable" };
  return { kind: "verdict", value: "default" };
}
`;
  const safeSource = `import { existsSync, readFileSync } from "node:fs";
type Outcome = { kind: "verdict"; value: string } | { kind: "unavailable" };
export function read(path: string): Outcome {
  if (existsSync(path)) return { kind: "verdict", value: readFileSync(path, "utf8") };
  return { kind: "unavailable" };
}
`;
  const [unsafe, safe] = await lintPair(
    { "src/sample/adapter/case.ts": unsafeSource },
    { "src/sample/adapter/case.ts": safeSource },
  );

  assertRule(unsafe, "filesystem-existence-gate");
  assertClean(safe);
});
