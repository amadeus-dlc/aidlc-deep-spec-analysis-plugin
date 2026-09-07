import { type Dirent, readdirSync, readFileSync, type Stats, statSync } from "node:fs";
import { err, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

function readFailure(path: string, error: unknown): RepositoryError {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return { kind: "not-found", path };
  return {
    kind: "io-failed",
    operation: "read",
    path,
    cause: error instanceof Error ? error.message : String(error),
  };
}

export function readArtifactBytes(path: string): Result<Uint8Array, RepositoryError> {
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    return err(readFailure(path, error));
  }
  return ok(bytes);
}

export function readArtifactText(path: string): Result<string, RepositoryError> {
  try {
    return ok(readFileSync(path, "utf-8"));
  } catch (error) {
    return err(readFailure(path, error));
  }
}

export function readDirectory(path: string): Result<readonly Dirent[], RepositoryError> {
  let entries: Dirent[];
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch (error) {
    return err(readFailure(path, error));
  }
  return ok(Object.freeze(entries));
}

export function readArtifactStat(path: string): Result<Stats, RepositoryError> {
  try {
    return ok(statSync(path));
  } catch (error) {
    return err(readFailure(path, error));
  }
}
