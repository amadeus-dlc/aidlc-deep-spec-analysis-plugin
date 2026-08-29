// deep-spec-refcheck-contract sensor — deterministic reference/structure
// checks for the contract-design summary (contract-summary.md).
//
// Check families (solver-free, LLM-free — phase 1):
//   CD-1  contracts-table rows parse; Provider Unit and Owner are declared
//         units; Consumer is a declared unit or `External: …`
//   CD-2  every fenced yaml spec block parses and carries its family
//         discriminator (openapi:+paths / asyncapi: / shared-schema)
//   CD-3  every inter-unit dependency edge has at least one contracts-table
//         row for that (provider, consumer) pair, in either orientation
//
// Declared units come from the machine-readable `units:` edge block in
// units-generation's unit-of-work-dependency.md (the same block the
// framework's batch fan-out is computed from). When that block is absent the
// unit-dependent families are skipped with reason absent-input — never
// guessed, never silent.
//
// Findings land in deep-spec-refcheck/contract-summary.json next to the
// artifact (contract 2, method: static, self-validated before writing).
//
// Sensor contract: parses --stage / --output-path (+ --report-only);
// pass-through on writes that are not contract-summary.md; one JSON verdict
// line on stdout; always exit 0.

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  type Finding,
  type InputEntry,
  type Json,
  type RefEntry,
  type Skipped,
  emitRefcheckDoc,
  extractFences,
  findRecordRoot,
  idCompare,
  isObject,
  parseFlags,
  parseMarkdownTables,
  parseYamlSubset,
  readIfExists,
  relArtifact,
  sha256,
  sortedUnique,
  verdictOut,
} from "./deep-spec-lib.ts";

const BACKEND = "contract-summary";
const TARGET_BASENAME = "contract-summary.md";
const FAMILIES = ["CD-1", "CD-2", "CD-3"];

interface UnitDecl {
  name: string;
  dependsOn: string[];
}

function parseUnits(depMd: string): { units: UnitDecl[]; error?: string } {
  const fences = extractFences(depMd, "yaml");
  for (const fence of fences) {
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) return { units: [], error: parsed.error };
    const v = parsed.value ?? null;
    if (!isObject(v) || !Array.isArray(v.units)) continue;
    const units: UnitDecl[] = [];
    for (const raw of v.units as Json[]) {
      if (!isObject(raw) || typeof raw.name !== "string") continue;
      const dependsOn = Array.isArray(raw.depends_on)
        ? (raw.depends_on as Json[]).filter((d): d is string => typeof d === "string")
        : [];
      units.push({ name: raw.name, dependsOn });
    }
    return { units };
  }
  return { units: [], error: "no yaml fence with a top-level `units:` list" };
}

function cleanCell(cell: string): string {
  return cell.replace(/[`*]/g, "").trim();
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-refcheck-contract: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== TARGET_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  let md: string;
  try {
    md = readFileSync(flags.outputPath, "utf-8");
  } catch {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const recordRoot = findRecordRoot(dirname(flags.outputPath));
  const artifact = relArtifact(recordRoot, flags.outputPath);
  const inputs: InputEntry[] = [{ artifact, sha256: sha256(md) }];
  const findings: Finding[] = [];
  const skipped: Skipped[] = [];
  const ref = (art: string, element: string, value?: string): RefEntry =>
    value === undefined ? { artifact: art, element } : { artifact: art, element, value };
  const finding = (family: string, kind: string, targets: string[], refs: RefEntry[], detail: string): void => {
    findings.push({
      kind,
      frRefs: [],
      targets: sortedUnique(targets, idCompare),
      witness: { refs },
      detail: `${family}: ${detail}`,
    });
  };
  const skipFamily = (family: string, reason: string, detail: string): void => {
    skipped.push({ target: `check:${family}`, reason, detail });
  };

  // --- declared units (unit-of-work-dependency.md edge block) --------------
  const depPath = recordRoot === null ? null : join(recordRoot, "inception", "units-generation", "unit-of-work-dependency.md");
  const depMd = depPath === null ? null : readIfExists(depPath);
  const depArtifact = depPath === null ? "unit-of-work-dependency.md" : relArtifact(recordRoot, depPath);
  let units: UnitDecl[] | null = null;
  if (depMd === null) {
    skipFamily("CD-1", "absent-input", "unit-of-work-dependency.md is not present under this intent record — declared units are unknown");
    skipFamily("CD-3", "absent-input", "unit-of-work-dependency.md is not present under this intent record — the unit dependency DAG is unknown");
  } else {
    inputs.push({ artifact: depArtifact, sha256: sha256(depMd) });
    const parsed = parseUnits(depMd);
    if (parsed.error !== undefined || parsed.units.length === 0) {
      skipFamily("CD-1", "unrecognized-format", `unit-of-work-dependency.md carries no parseable \`units:\` edge block${parsed.error ? ` (${parsed.error})` : ""}`);
      skipFamily("CD-3", "unrecognized-format", "blocked: the units edge block is unusable");
    } else {
      units = parsed.units;
    }
  }

  // --- CD-1: contracts table -------------------------------------------------
  const tables = parseMarkdownTables(md);
  const contractsTable = tables.find((t) => t.header.some((h) => /provider/i.test(h)));
  interface ContractRow {
    id: string;
    provider: string;
    consumer: string;
    owner: string;
    line: number;
  }
  let rows: ContractRow[] = [];
  if (!contractsTable) {
    if (units !== null) skipFamily("CD-1", "unrecognized-format", "no markdown table with a Provider column found");
    skipFamily("CD-3", "unrecognized-format", "no contracts table — DAG edge coverage cannot be checked");
  } else {
    const col = (re: RegExp): number => contractsTable.header.findIndex((h) => re.test(h));
    const pCol = col(/provider/i);
    const cCol = col(/consumer/i);
    const oCol = col(/owner/i);
    rows = contractsTable.rows.map((r, i) => {
      const first = cleanCell(r.cells[0] ?? "");
      return {
        id: /^[0-9]+$/.test(first) ? first : String(i + 1),
        provider: cleanCell(r.cells[pCol] ?? ""),
        consumer: cCol >= 0 ? cleanCell(r.cells[cCol] ?? "") : "",
        owner: oCol >= 0 ? cleanCell(r.cells[oCol] ?? "") : "",
        line: r.line,
      };
    });
    if (units !== null) {
      const declared = new Set(units.map((u) => u.name));
      for (const row of rows) {
        const el = `contracts table row ${row.id} (line ${row.line})`;
        if (row.provider !== "" && !declared.has(row.provider)) {
          finding("CD-1", "reference-broken", [`contract:${row.id}`, `unit:${row.provider}`],
            [ref(artifact, el, row.provider), ref(depArtifact, "units")],
            `Provider Unit "${row.provider}" is not a declared unit`);
        }
        if (row.consumer !== "" && !declared.has(row.consumer) && !/^external\b/i.test(row.consumer)) {
          finding("CD-1", "reference-broken", [`contract:${row.id}`, `unit:${row.consumer}`],
            [ref(artifact, el, row.consumer), ref(depArtifact, "units")],
            `Consumer "${row.consumer}" is neither a declared unit nor \`External: …\``);
        }
        if (row.owner !== "" && !declared.has(row.owner)) {
          finding("CD-1", "reference-broken", [`contract:${row.id}`, `unit:${row.owner}`],
            [ref(artifact, el, row.owner), ref(depArtifact, "units")],
            `Owner "${row.owner}" is not a declared unit`);
        }
      }
    }
  }

  // --- CD-2: spec blocks -----------------------------------------------------
  const fences = extractFences(md, "yaml");
  fences.forEach((fence, i) => {
    const blockId = `contract:block-${i + 1}`;
    const el = `yaml fence #${i + 1} (line ${fence.line})`;
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) {
      finding("CD-2", "structure-invalid", [blockId], [ref(artifact, el)],
        `spec block does not parse in the supported YAML subset: ${parsed.error}`);
      return;
    }
    const v = parsed.value ?? null;
    if (!isObject(v)) {
      finding("CD-2", "structure-invalid", [blockId], [ref(artifact, el)], "spec block is not a YAML mapping");
      return;
    }
    if ("openapi" in v && !("paths" in v)) {
      finding("CD-2", "structure-invalid", [blockId], [ref(artifact, el, "openapi")],
        "OpenAPI spec block carries `openapi:` but no `paths:`");
    }
    // asyncapi and shared-schema blocks: parseability is the check.
  });

  // --- CD-3: DAG edge coverage ----------------------------------------------
  if (units !== null && contractsTable) {
    const covered = new Set<string>();
    for (const row of rows) {
      covered.add(`${row.provider} ${row.consumer}`);
      covered.add(`${row.consumer} ${row.provider}`);
    }
    for (const u of [...units].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      for (const dep of [...u.dependsOn].sort()) {
        if (!units.some((d) => d.name === dep)) continue; // dangling edge is units-generation's problem
        if (!covered.has(`${dep} ${u.name}`)) {
          finding("CD-3", "consistency-mismatch", [`unit:${dep}`, `unit:${u.name}`],
            [ref(depArtifact, `units (${u.name} depends_on ${dep})`), ref(artifact, "contracts table")],
            `unit dependency edge "${u.name}" -> "${dep}" has no contracts-table row in either orientation`);
        }
      }
    }
  }

  const failedFamilies = new Set(findings.map((f) => f.detail.split(":")[0] ?? ""));
  const skippedFamilies = new Set(skipped.map((s) => (s.target.startsWith("check:") ? s.target.slice(6) : "")));
  const checked = FAMILIES.filter((f) => !failedFamilies.has(f) && !skippedFamilies.has(f)).map((f) => `check:${f}`);

  emitRefcheckDoc(join(dirname(flags.outputPath), "deep-spec-refcheck"), {
    backend: BACKEND,
    inputs,
    checked,
    findings,
    skipped,
  }, flags.reportOnly);

  verdictOut(findings.length === 0, findings.length, skipped.length, flags.reportOnly ? "report-only" : undefined);
}

main();
