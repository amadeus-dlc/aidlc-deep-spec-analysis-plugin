// contract-summary.md と units エッジブロックの解析 — 形式知識をここに封じ、
// 型付きの outcome へ解く。抽出ロジックは旧センサーの逐語移動。

import { extractFences } from "@deep-spec/kernel-adapter";
import { parseMarkdownTables } from "@deep-spec/kernel-adapter";
import { parseYamlSubset } from "@deep-spec/kernel-adapter";
import { type Json, combineResults, traverseResult, isObject } from "@deep-spec/kernel-infrastructure";

import {
  BlockIndex,
  ContractId,
  ContractParty,
  ContractRows,
  LineNumber,
  SpecBlockAssessments,
  UnitDecls,
  UnitName,
  UnitNames,
  UnitDecl,
  ContractRow,
  ContractsTableOutcome,
  DeclaredUnitsOutcome,
  SpecBlockAssessment,
} from "@deep-spec/refcheck-domain";

export function parseDeclaredUnits(depMd: string | null): DeclaredUnitsOutcome {
  if (depMd === null) return DeclaredUnitsOutcome.absent();
  const fences = extractFences(depMd, "yaml");
  for (const fence of fences) {
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) return DeclaredUnitsOutcome.unrecognized(parsed.error);
    const v = parsed.value ?? null;
    if (!isObject(v) || !Array.isArray(v.units)) continue;
    const units: UnitDecl[] = [];
    for (const raw of v.units as Json[]) {
      if (!isObject(raw) || typeof raw.name !== "string") continue;
      const dependsOn = Array.isArray(raw.depends_on)
        ? (raw.depends_on as Json[]).filter((d): d is string => typeof d === "string")
        : [];
      const fields = combineResults({ name: UnitName.parse(raw.name), dependsOn: traverseResult(dependsOn, UnitName.parse) });
      if (!fields.ok) return DeclaredUnitsOutcome.unrecognized(JSON.stringify(fields.error));
      units.push(UnitDecl.of({ name: fields.value.name, dependsOn: UnitNames.of(fields.value.dependsOn) }));
    }
    if (units.length === 0) return DeclaredUnitsOutcome.unrecognized();
    return DeclaredUnitsOutcome.declared(UnitDecls.of(units));
  }
  return DeclaredUnitsOutcome.unrecognized("no yaml fence with a top-level `units:` list");
}

function cleanCell(cell: string): string {
  return cell.replace(/[`*]/g, "").trim();
}

export function parseContractsTable(md: string): ContractsTableOutcome {
  const tables = parseMarkdownTables(md);
  const contractsTable = tables.find((t) => t.header.some((h) => /provider/i.test(h)));
  if (!contractsTable) return ContractsTableOutcome.absent();
  const col = (re: RegExp): number => contractsTable.header.findIndex((h) => re.test(h));
  const pCol = col(/provider/i);
  const cCol = col(/consumer/i);
  const oCol = col(/owner/i);
  return ContractsTableOutcome.rows(
    ContractRows.of(
      contractsTable.rows.map((r, i) => {
        const first = cleanCell(r.cells[0] ?? "");
        return ContractRow.of({
          id: ContractId.of(/^[0-9]+$/.test(first) ? first : String(i + 1)),
          provider: ContractParty.of(cleanCell(r.cells[pCol] ?? "")),
          consumer: ContractParty.of(cCol >= 0 ? cleanCell(r.cells[cCol] ?? "") : ""),
          owner: ContractParty.of(oCol >= 0 ? cleanCell(r.cells[oCol] ?? "") : ""),
          line: LineNumber.of(r.line),
        });
      }),
    ),
  );
}

export function assessSpecBlocks(md: string): SpecBlockAssessments {
  const blocks: SpecBlockAssessment[] = extractFences(md, "yaml").map((fence, i) => {
    const index = BlockIndex.of(i + 1);
    const line = LineNumber.of(fence.line);
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) {
      return SpecBlockAssessment.unparseable(index, line, parsed.error);
    }
    const v = parsed.value ?? null;
    if (!isObject(v)) {
      return SpecBlockAssessment.notAMapping(index, line);
    }
    if ("openapi" in v && !("paths" in v)) {
      return SpecBlockAssessment.openapiWithoutPaths(index, line);
    }
    // asyncapi and shared-schema blocks: parseability is the check.
    return SpecBlockAssessment.sound(index, line);
  });
  return SpecBlockAssessments.of(blocks);
}
