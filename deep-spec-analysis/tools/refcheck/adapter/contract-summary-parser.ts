// contract-summary.md と units エッジブロックの解析 — 形式知識をここに封じ、
// 型付きの outcome へ解く。抽出ロジックは旧センサーの逐語移動。

import { extractFences } from "../../kernel/adapter/markdown-fences.ts";
import { type Json, isObject } from "../../kernel/adapter/json-value.ts";
import { parseMarkdownTables } from "../../kernel/adapter/markdown-tables.ts";
import { parseYamlSubset } from "../../kernel/adapter/yaml-subset.ts";
import type {
  ContractsTableOutcome,
  DeclaredUnitsOutcome,
  SpecBlockAssessment,
  UnitDecl,
} from "../domain/index.ts";

export function parseDeclaredUnits(depMd: string | null): DeclaredUnitsOutcome {
  if (depMd === null) return { kind: "absent" };
  const fences = extractFences(depMd, "yaml");
  for (const fence of fences) {
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) return { kind: "unrecognized", error: parsed.error };
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
    if (units.length === 0) return { kind: "unrecognized" };
    return { kind: "declared", units };
  }
  return { kind: "unrecognized", error: "no yaml fence with a top-level `units:` list" };
}

function cleanCell(cell: string): string {
  return cell.replace(/[`*]/g, "").trim();
}

export function parseContractsTable(md: string): ContractsTableOutcome {
  const tables = parseMarkdownTables(md);
  const contractsTable = tables.find((t) => t.header.some((h) => /provider/i.test(h)));
  if (!contractsTable) return { kind: "absent" };
  const col = (re: RegExp): number => contractsTable.header.findIndex((h) => re.test(h));
  const pCol = col(/provider/i);
  const cCol = col(/consumer/i);
  const oCol = col(/owner/i);
  return {
    kind: "rows",
    rows: contractsTable.rows.map((r, i) => {
      const first = cleanCell(r.cells[0] ?? "");
      return {
        id: /^[0-9]+$/.test(first) ? first : String(i + 1),
        provider: cleanCell(r.cells[pCol] ?? ""),
        consumer: cCol >= 0 ? cleanCell(r.cells[cCol] ?? "") : "",
        owner: oCol >= 0 ? cleanCell(r.cells[oCol] ?? "") : "",
        line: r.line,
      };
    }),
  };
}

export function assessSpecBlocks(md: string): SpecBlockAssessment[] {
  return extractFences(md, "yaml").map((fence, i) => {
    const base = { index: i + 1, line: fence.line };
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) {
      return { ...base, issue: { kind: "unparseable" as const, error: parsed.error } };
    }
    const v = parsed.value ?? null;
    if (!isObject(v)) {
      return { ...base, issue: { kind: "not-a-mapping" as const } };
    }
    if ("openapi" in v && !("paths" in v)) {
      return { ...base, issue: { kind: "openapi-without-paths" as const } };
    }
    // asyncapi and shared-schema blocks: parseability is the check.
    return { ...base, issue: null };
  });
}
