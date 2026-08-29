// アーキテクチャテスト（issue #13 骨格 → PR10 で allowlist 空化）。
//
// 二段構え:
//   1. red/green example — 各ルールが違反を実際に検出できることを、実ツリーへ
//      適用する前にインラインの fixture ソースで証明する（カスタム検査の DoD:
//      検出力の証明なきルールはそれ自体がレビュー指摘）。
//   2. 実ツリー走査 — tools/ 配下の全 .ts を走査し違反ゼロを表明する。
//      現行フラット 13 ファイルは rules.ts の LEGACY_FILES として層規律を
//      免除されており、移行 PR が進むたびに縮む。

import { describe, expect, test } from "bun:test";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENTRY_FILES,
  LEGACY_FILES,
  layerDirection,
  locationOf,
  noEntryImports,
  noExportStar,
  noIoInPureLayers,
  noTestPayloads,
  onlySanctionedImports,
  processOnlyInEntries,
  violationsOf,
} from "./architecture/rules.ts";

const toolsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tools");

function walkToolsFiles(dir = toolsDir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    const stat = lstatSync(p);
    expect(stat.isSymbolicLink()).toBe(false);
    if (stat.isDirectory()) out.push(...walkToolsFiles(p));
    else if (entry.endsWith(".ts")) out.push(relative(toolsDir, p));
  }
  return out;
}

describe("rule red/green examples (detection power proof)", () => {
  test("no-test-payloads flags a test file and a fixtures directory, passes a plain module", () => {
    expect(noTestPayloads("kernel/domain/digest.test.ts", "")).not.toHaveLength(0);
    expect(noTestPayloads("kernel/fixtures/x.ts", "")).not.toHaveLength(0);
    expect(noTestPayloads("kernel/domain/digest.ts", "")).toHaveLength(0);
  });

  test("only-sanctioned-imports flags an npm import, passes node:/relative/z3-solver", () => {
    expect(onlySanctionedImports("kernel/domain/x.ts", 'import { z } from "zod";')).not.toHaveLength(0);
    expect(
      onlySanctionedImports(
        "kernel/domain/x.ts",
        'import { createHash } from "node:crypto";\nimport { y } from "./y.ts";\nconst m = await import("z3-solver");',
      ),
    ).toHaveLength(0);
  });

  test("a string literal containing the word from is not mistaken for an import", () => {
    expect(onlySanctionedImports("kernel/domain/x.ts", 'const detail = `enum mapping from "${src}" is not total`;')).toHaveLength(0);
  });

  test("a dynamic import with a non-literal argument is flagged (template literal and concatenation)", () => {
    expect(onlySanctionedImports("kernel/adapter/x.ts", "const m = await import(`zod`);")).not.toHaveLength(0);
    expect(onlySanctionedImports("kernel/adapter/x.ts", 'const m = await import("./" + name);')).not.toHaveLength(0);
    expect(onlySanctionedImports("kernel/adapter/x.ts", 'const m = await import("z3-solver");')).toHaveLength(0);
  });

  test("no-entry-imports flags an import of a composition root", () => {
    expect(noEntryImports("kernel/adapter/x.ts", 'import { m } from "../../aidlc-sensor-deep-spec-ir-valid.ts";')).not.toHaveLength(0);
    expect(noEntryImports("kernel/adapter/x.ts", 'import { m } from "./y.ts";')).toHaveLength(0);
  });

  test("no-io-in-pure-layers flags node:fs in domain and child_process in usecase, allows node:crypto in domain", () => {
    expect(noIoInPureLayers("kernel/domain/x.ts", 'import { readFileSync } from "node:fs";')).not.toHaveLength(0);
    expect(noIoInPureLayers("design/usecase/x.ts", 'import { spawnSync } from "node:child_process";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/domain/digest.ts", 'import { createHash } from "node:crypto";')).toHaveLength(0);
    expect(noIoInPureLayers("kernel/adapter/x.ts", 'import { readFileSync } from "node:fs";')).toHaveLength(0);
  });

  test("a node:fs subpath does not slip past the usecase ban", () => {
    expect(noIoInPureLayers("design/usecase/x.ts", 'import { readFile } from "node:fs/promises";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/domain/x.ts", 'import { readFile } from "node:fs/promises";')).not.toHaveLength(0);
  });

  test("process-only-in-entries flags process.env and import.meta in layered files", () => {
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const v = process.env.X;")).not.toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const p = import.meta.url;")).not.toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const v = 1;")).toHaveLength(0);
  });

  test("no-export-star flags a wildcard re-export, passes an explicit facade", () => {
    expect(noExportStar("kernel/domain/index.ts", 'export * from "./digest.ts";')).not.toHaveLength(0);
    expect(noExportStar("kernel/domain/index.ts", 'export { Digest } from "./digest.ts";')).toHaveLength(0);
  });

  test("layer-direction flags domain→adapter, adapter→foreign-context, passes sanctioned edges", () => {
    expect(layerDirection("kernel/domain/x.ts", 'import { y } from "../adapter/y.ts";')).not.toHaveLength(0);
    expect(layerDirection("refcheck/adapter/x.ts", 'import { y } from "../../design/domain/y.ts";')).not.toHaveLength(0);
    expect(layerDirection("refinement/domain/x.ts", 'import { y } from "../../requirements/domain/y.ts";')).toHaveLength(0);
    expect(layerDirection("design/usecase/x.ts", 'import { y } from "../../refinement/domain/y.ts";')).toHaveLength(0);
    expect(layerDirection("design/usecase/x.ts", 'import { y } from "../domain/y.ts";')).toHaveLength(0);
  });

  test("a relative import escaping tools/ (unclassified target) is flagged", () => {
    expect(layerDirection("kernel/domain/x.ts", 'import { h } from "../../../tests/helper.ts";')).not.toHaveLength(0);
  });

  test("locationOf classifies entries, legacy files, data, and layered paths", () => {
    expect(locationOf("aidlc-sensor-deep-spec-ir-valid.ts")).toBe("entry");
    expect(locationOf("deep-spec-lib.ts")).toBe("legacy");
    expect(locationOf("data/deep-spec-ir-schema.json")).toBe("data");
    expect(locationOf("kernel/domain/digest.ts")).toEqual({ context: "kernel", layer: "domain" });
  });
});

describe("the real tools/ tree", () => {
  const files = walkToolsFiles();

  test("contains the nine flat sensor entries and the doctor", () => {
    for (const entry of ENTRY_FILES) expect(files).toContain(entry);
  });

  test("every file passes every architecture rule", () => {
    const all = files.flatMap((rel) => violationsOf(rel, readFileSync(join(toolsDir, rel), "utf-8")));
    expect(all).toEqual([]);
  });

  test("every file is either layered, an entry, legacy, or data — nothing unclassified", () => {
    const unclassified = files.filter((rel) => locationOf(rel) === null);
    expect(unclassified).toEqual([]);
  });

  test("the legacy allowlist only shrinks — no unlisted flat file appears", () => {
    const flat = files.filter((rel) => !rel.includes("/"));
    for (const rel of flat) expect(LEGACY_FILES.has(rel)).toBe(true);
  });

  test("the legacy allowlist never grows beyond the original 13 files (removals only)", () => {
    // 移行開始時点（2026-08-29、ロードマップ #12）の固定集合。ここへの追加は
    // 移行の逆行なので、allowlist へ新ファイルを足す変更はこのテストで落ちる。
    const original = new Set([
      "aidlc-sensor-deep-spec-ir-valid.ts",
      "aidlc-sensor-deep-spec-verify-smt.ts",
      "aidlc-sensor-deep-spec-verify-quint.ts",
      "aidlc-sensor-deep-spec-refcheck-domain.ts",
      "aidlc-sensor-deep-spec-refcheck-contract.ts",
      "aidlc-sensor-deep-spec-refcheck-functional.ts",
      "aidlc-sensor-deep-spec-design-ir-valid.ts",
      "aidlc-sensor-deep-spec-design-verify-smt.ts",
      "aidlc-sensor-deep-spec-design-verify-quint.ts",
      "deep-spec-analysis-doctor.ts",
      "deep-spec-lib.ts",
      "deep-spec-design-lib.ts",
      "deep-spec-refinement-lib.ts",
    ]);
    for (const rel of LEGACY_FILES) expect(original.has(rel)).toBe(true);
  });
});
