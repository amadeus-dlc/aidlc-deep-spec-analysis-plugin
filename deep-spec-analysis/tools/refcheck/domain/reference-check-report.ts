// ReferenceCheckReport 集約 — 契約2 の refcheck 文書そのもの。
//
// Always-Valid: 正準キー順の組立・findings スキーマに対する自己検証・
// 不適合時の unavailable 降格は**構築時に完結**し、構築後の本体は常に
// 契約適合の文書である（「書き手は不適合ファイルを決して出さない」の
// 型による言い換え）。入口は 2 つ：
//   - compose      … 検査結果から新規に組む（降格が仕様の一部なので失敗しない）
//   - reconstitute … 書かれた真実（Repository が読んだ Json）からの再構成。
//                    集約として成立しない形は材料つきで拒否する
// 描画バイト（JSON.stringify(・, null, 2) + "\n"）と降格文言は golden 凍結。

import {
  type Json,
  type Result,
  type Schema,
  canonicalStringify,
  err,
  idCompare,
  isObject,
  ok,
  sha256,
  sortedUnique,
  validateSchema,
} from "../../kernel/domain/index.ts";
import { CATALOG_VERSION } from "./catalog-version.ts";
import { sortFindings, sortSkipped } from "./catalog-order.ts";
import type { Finding } from "./finding.ts";
import type { InputEntry } from "./input-entry.ts";
import { ReferenceCheckReportId } from "./reference-check-report-id.ts";
import type { Skipped } from "./skipped.ts";

// スキーマが読めなかったときの材料（cause は降格文言に逐語で載る）。
export interface FindingsSchemaUnreadable {
  readonly cause: string;
}

export interface ReferenceCheckReportSeed {
  readonly id: ReferenceCheckReportId;
  readonly inputs: readonly InputEntry[];
  readonly checked: readonly string[];
  readonly findings: readonly Finding[];
  readonly skipped: readonly Skipped[];
  readonly findingsSchema: Result<Schema, FindingsSchemaUnreadable>;
}

export class ReferenceCheckReport {
  readonly #id: ReferenceCheckReportId;
  readonly #ordered: { [k: string]: Json };
  readonly #findingsCount: number;
  readonly #skippedCount: number;
  readonly #unavailable: boolean;

  private constructor(id: ReferenceCheckReportId, ordered: { [k: string]: Json }) {
    this.#id = id;
    this.#ordered = ordered;
    this.#findingsCount = (ordered.findings as Json[]).length;
    this.#skippedCount = (ordered.skipped as Json[]).length;
    this.#unavailable = "unavailable" in ordered;
  }

  // 検査結果からの唯一の新規構築口。正準組立＋自己検証＋降格まで済ませ、
  // 常に契約適合の文書を返す。
  static compose(seed: ReferenceCheckReportSeed): ReferenceCheckReport {
    const inputs = [...seed.inputs].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0));
    const irHash = sha256(canonicalStringify(inputs as unknown as Json));
    const assemble = (d: {
      unavailable?: { reason: string };
      checked: readonly string[];
      findings: readonly Finding[];
      skipped: readonly Skipped[];
    }): { [k: string]: Json } => {
      const ordered: { [k: string]: Json } = {
        backend: seed.id.backendName(),
        irVersion: CATALOG_VERSION,
        irHash,
        method: "static",
      };
      if (d.unavailable) ordered.unavailable = d.unavailable as unknown as Json;
      ordered.inputs = inputs as unknown as Json;
      ordered.checked = sortedUnique([...d.checked], idCompare) as unknown as Json;
      ordered.findings = sortFindings([...d.findings]) as unknown as Json;
      ordered.skipped = sortSkipped([...d.skipped]) as unknown as Json;
      return ordered;
    };
    let ordered = assemble(seed);
    if (seed.findingsSchema.ok) {
      const schemaDoc = seed.findingsSchema.value;
      const errors: string[] = [];
      validateSchema(schemaDoc, schemaDoc, ordered as Json, "", errors);
      if (errors.length > 0) {
        ordered = assemble({
          unavailable: { reason: `self-validation against deep-spec-findings-schema.json failed: ${errors[0]}` },
          checked: [],
          findings: [],
          skipped: [],
        });
      }
    } else {
      ordered = assemble({
        unavailable: { reason: `findings schema unreadable: ${seed.findingsSchema.error.cause}` },
        checked: [],
        findings: [],
        skipped: [],
      });
    }
    return new ReferenceCheckReport(seed.id, ordered);
  }

  // 書かれた真実からの再構成（Repository の読出側だけが使う）。書込時に
  // 自己検証済みなので全面再検証はせず、集約が成立する最小形だけを確かめる。
  static reconstitute(id: ReferenceCheckReportId, raw: Json): Result<ReferenceCheckReport, { cause: string }> {
    if (!isObject(raw)) return err({ cause: "document is not a JSON object" });
    if (raw.backend !== id.backendName()) {
      return err({ cause: `document backend "${String(raw.backend)}" does not match the id backend "${id.backendName()}"` });
    }
    if (!Array.isArray(raw.findings) || !Array.isArray(raw.skipped)) {
      return err({ cause: "document lacks findings/skipped arrays" });
    }
    return ok(new ReferenceCheckReport(id, raw));
  }

  id(): ReferenceCheckReportId {
    return this.#id;
  }

  findingsCount(): number {
    return this.#findingsCount;
  }

  skippedCount(): number {
    return this.#skippedCount;
  }

  isUnavailable(): boolean {
    return this.#unavailable;
  }

  // センサー verdict の述語：降格しておらず finding が 0 なら pass。
  passes(): boolean {
    return !this.#unavailable && this.#findingsCount === 0;
  }

  // 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
  renderBytes(): string {
    return `${JSON.stringify(this.#ordered, null, 2)}\n`;
  }
}
