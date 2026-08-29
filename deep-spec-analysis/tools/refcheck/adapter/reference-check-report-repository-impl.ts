// ReferenceCheckReportRepository の実 Gateway 実装。
// 旧 deep-spec-lib.ts の emitRefcheckDoc を逐語で内包する（組立の正準キー順・
// 自己検証・unavailable 降格・`JSON.stringify(・, null, 2) + "\n"` の描画は
// すべて golden バイトを決める凍結挙動）。findings スキーマのパスは合成ルート
// （entry）から注入される——層構造のファイルは import.meta を触らない。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Json,
  type Schema,
  canonicalStringify,
  idCompare,
  sha256,
  sortedUnique,
  validateSchema,
} from "../../kernel/domain/index.ts";
import {
  CATALOG_VERSION,
  type EmitResult,
  type RefcheckDoc,
  sortFindings,
  sortSkipped,
} from "../domain/index.ts";
import type { ReferenceCheckReportRepository } from "../usecase/index.ts";

export class ReferenceCheckReportRepositoryImpl implements ReferenceCheckReportRepository {
  readonly #findingsSchemaPath: string;

  constructor(findingsSchemaPath: string) {
    this.#findingsSchemaPath = findingsSchemaPath;
  }

  // Assembles the contract-2 document (canonical key order, canonical sorts),
  // self-validates it against the findings schema (FR: a writer never emits a
  // non-conforming file — on failure it degrades to an `unavailable` document
  // carrying the validation error), and writes it unless reportOnly. Returns
  // the counts of the document actually written, so the caller's stdout
  // verdict can never contradict the file.
  save(outDir: string, doc: RefcheckDoc, reportOnly: boolean): EmitResult {
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
      const schemaDoc = JSON.parse(readFileSync(this.#findingsSchemaPath, "utf-8")) as Schema;
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
}
