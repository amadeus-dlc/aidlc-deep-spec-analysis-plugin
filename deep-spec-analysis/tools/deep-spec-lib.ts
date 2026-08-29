// Shared deterministic machinery for the deep-spec-refcheck-* sensors
// (phase 1: solver-free reference/structure integrity checks).
//
// This is a PLUGIN-INTERNAL library: it ships in the same compose delta as
// the sensor scripts that import it, so the self-containment rule (never
// import a framework/core tool) is preserved.
//
// DDD 移行 PR1（issue #14）: 純粋関数群（Json/canonical/sha256/idCompare/
// fence/YAML/tables/schema-validator/safeTarget/requirementIds/normalizeName）
// は tools/kernel/domain/ へ逐語移動した。ここに残るのは契約2 の findings
// 語彙とライタ・I/O 付きヘルパ・センサー CLI 契約——後続 PR で各コンテキスト
// へ解体される予定の残余のみ。再輸出はしない（互換 shim 禁止）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Json,
  type Schema,
  canonicalStringify,
  idCompare,
  sha256,
  sortedUnique,
  validateSchema,
} from "./kernel/domain/index.ts";

// Extended kind rank (NFR1). Preserves the relative order of the v1 kinds.
const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  unreachable: 3,
  redundancy: 4,
  "refinement-violation": 5,
  "mapping-gap": 6,
  "structure-invalid": 7,
  "reference-broken": 8,
  "consistency-mismatch": 9,
  "cross-check-disagreement": 10,
};

export interface RefEntry {
  artifact: string;
  element: string;
  value?: string;
}

export interface Finding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: { refs: RefEntry[] };
  unit?: string;
  detail: string;
}

export interface Skipped {
  target: string;
  reason: string;
  unit?: string;
  detail?: string;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const kr = (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99);
    if (kr !== 0) return kr;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export function sortSkipped(skipped: Skipped[]): Skipped[] {
  return [...skipped].sort((a, b) => {
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

// --- findings document assembly (contract 2 + self-validation) ---------------

export const CATALOG_VERSION = "1.0.0";

export interface InputEntry {
  artifact: string;
  sha256: string;
}

export interface RefcheckDoc {
  backend: string;
  unavailable?: { reason: string };
  inputs: InputEntry[];
  checked: string[];
  findings: Finding[];
  skipped: Skipped[];
}

function findingsSchemaPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json");
}

export interface EmitResult {
  findingsCount: number;
  skippedCount: number;
  unavailable: boolean;
}

// Assembles the contract-2 document (canonical key order, canonical sorts),
// self-validates it against the findings schema (FR: a writer never emits a
// non-conforming file — on failure it degrades to an `unavailable` document
// carrying the validation error), and writes it unless reportOnly. Returns
// the counts of the document actually written, so the caller's stdout
// verdict can never contradict the file.
export function emitRefcheckDoc(outDir: string, doc: RefcheckDoc, reportOnly: boolean): EmitResult {
  const inputs = [...doc.inputs].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0));
  const irHash = sha256(canonicalStringify(inputs as unknown as Json));
  const assemble = (d: RefcheckDoc): { [k: string]: Json } => {
    const ordered: { [k: string]: Json } = {
      backend: d.backend,
      irVersion: CATALOG_VERSION,
      irHash,
      method: "static",
    };
    if (d.unavailable) ordered.unavailable = d.unavailable as unknown as Json;
    ordered.inputs = inputs as unknown as Json;
    ordered.checked = sortedUnique(d.checked, idCompare) as unknown as Json;
    ordered.findings = sortFindings(d.findings) as unknown as Json;
    ordered.skipped = sortSkipped(d.skipped) as unknown as Json;
    return ordered;
  };
  let ordered = assemble(doc);
  try {
    const schemaDoc = JSON.parse(readFileSync(findingsSchemaPath(), "utf-8")) as Schema;
    const errors: string[] = [];
    validateSchema(schemaDoc, schemaDoc, ordered as Json, "", errors);
    if (errors.length > 0) {
      ordered = assemble({
        backend: doc.backend,
        unavailable: { reason: `self-validation against deep-spec-findings-schema.json failed: ${errors[0]}` },
        inputs: doc.inputs,
        checked: [],
        findings: [],
        skipped: [],
      });
    }
  } catch (err) {
    ordered = assemble({
      backend: doc.backend,
      unavailable: { reason: `findings schema unreadable: ${err instanceof Error ? err.message : String(err)}` },
      inputs: doc.inputs,
      checked: [],
      findings: [],
      skipped: [],
    });
  }
  if (!reportOnly) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${doc.backend}.json`), `${JSON.stringify(ordered, null, 2)}\n`, "utf-8");
  }
  return {
    findingsCount: (ordered.findings as Json[]).length,
    skippedCount: (ordered.skipped as Json[]).length,
    unavailable: "unavailable" in ordered,
  };
}

// --- record-root and requirements resolution ---------------------------------

// Ascend from the written artifact's directory to the intent record root —
// the directory that contains the phase directories (inception/…,
// construction/…). Bounded walk; null when no root shape is found.
export function findRecordRoot(startDir: string): string | null {
  let d = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, "inception")) || existsSync(join(d, "aidlc-state.md"))) return d;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

export function relArtifact(recordRoot: string | null, absPath: string): string {
  if (recordRoot && absPath.startsWith(`${recordRoot}/`)) {
    return absPath.slice(recordRoot.length + 1);
  }
  return absPath.split("/").slice(-1)[0] ?? absPath;
}

// --- sensor CLI contract ------------------------------------------------------

export function parseFlags(argv: string[]): { stage: string; outputPath: string; reportOnly: boolean } {
  let stage = "";
  let outputPath = "";
  let reportOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") stage = argv[i + 1] ?? "";
    if (argv[i] === "--output-path") outputPath = argv[i + 1] ?? "";
    if (argv[i] === "--report-only") reportOnly = true;
  }
  return { stage, outputPath, reportOnly };
}

export function verdictOut(pass: boolean, findings: number, skipped: number, note?: string): never {
  const out: { [k: string]: Json } = { pass, findings_count: findings, skipped_count: skipped, method: "static" };
  if (note) out.note = note;
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

export function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}
