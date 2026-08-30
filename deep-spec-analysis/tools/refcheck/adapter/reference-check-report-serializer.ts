// ReferenceCheckReport の直列化・契約適合・解体 — 形式（JSON）の知識は
// すべてここに封じる。正準キー順・irHash（inputs の正準 JSON の sha256）・
// `JSON.stringify(・, null, 2) + "\n"` の描画・findings スキーマ自己検証・
// 降格文言（golden 凍結）は本モジュールの責務。
//
// conformToContract が「書き手は不適合ファイルを決して出さない」の実装：
// 直列化形をスキーマ検証し、不適合なら降格した集約を返す。verdict は
// この戻り値から導出させることで、stdout とファイルの矛盾を構造的に防ぐ。

import type { Result } from "../../kernel/infrastructure/index.ts";
import { ContentHash } from "../../kernel/domain/index.ts";
import { canonicalStringify } from "../../kernel/adapter/canonical-json.ts";
import { type Json, isObject } from "../../kernel/adapter/json-value.ts";
import { type Schema, validateSchema } from "../../kernel/adapter/schema-validator.ts";
import type { SchemaUnreadable } from "../../kernel/adapter/contract-schema.ts";
import { FrRefs, TargetIds } from "../../kernel/domain/index.ts";
import {
  CATALOG_VERSION,
  type Finding,
  type Skipped,
  type WitnessRef,
  Findings,
  InputAnchors,
  ReferenceCheckReport,
  type ReferenceCheckReportId,
  Skips,
  WitnessRefs,
} from "../domain/index.ts";

function orderedDocument(report: ReferenceCheckReport): { [k: string]: Json } {
  // ContentHash は境界（描画）で asString() へ落とす——DP のままでは正準 JSON に
  // 乗らない。各キー順は旧構築サイトの挿入順そのもの（golden バイト凍結）：
  // inputs は (artifact, sha256)、finding は (kind, frRefs, targets, witness,
  // detail, unit?)、witness ref は (artifact, element, value?)、skip は
  // (target, reason, detail?, unit?)。ペイロードのコレクションはこの描画点で
  // だけ toArray() に降りる。
  const inputs = report.inputs().toArray().map((i) => ({ artifact: i.artifact, sha256: i.sha256.asString() })) as unknown as Json;
  const ordered: { [k: string]: Json } = {
    backend: report.id().backendName(),
    irVersion: CATALOG_VERSION,
    irHash: ContentHash.ofText(canonicalStringify(inputs)).asString(),
    method: "static",
  };
  const reason = report.unavailableReason();
  if (reason !== null) ordered.unavailable = { reason };
  ordered.inputs = inputs;
  ordered.checked = report.checked().toArray() as unknown as Json;
  ordered.findings = report.findings().toArray().map((f) => {
    const refs = f.witness.refs.toArray().map((r) => {
      const out: { [k: string]: Json } = { artifact: r.artifact, element: r.element };
      if (r.value !== undefined) out.value = r.value;
      return out as Json;
    });
    const out: { [k: string]: Json } = {
      kind: f.kind,
      frRefs: f.frRefs.toArray() as unknown as Json,
      targets: f.targets.toArray() as unknown as Json,
      witness: { refs },
      detail: f.detail,
    };
    if (f.unit !== undefined) out.unit = f.unit;
    return out as Json;
  });
  ordered.skipped = report.skipped().toArray().map((sk) => {
    const out: { [k: string]: Json } = { target: sk.target, reason: sk.reason };
    if (sk.detail !== undefined) out.detail = sk.detail;
    if (sk.unit !== undefined) out.unit = sk.unit;
    return out as Json;
  });
  return ordered;
}

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderReportBytes(report: ReferenceCheckReport): string {
  return `${JSON.stringify(orderedDocument(report), null, 2)}\n`;
}

// 契約2 への適合を保証した集約を返す。スキーマ不可読・自己検証不適合は
// 降格（文言は凍結）。適合していれば元の集約をそのまま返す。
export function conformToContract(
  report: ReferenceCheckReport,
  findingsSchema: Result<Schema, SchemaUnreadable>,
): ReferenceCheckReport {
  if (!findingsSchema.ok) {
    return report.degraded(`findings schema unreadable: ${findingsSchema.error.cause}`);
  }
  const errors: string[] = [];
  validateSchema(findingsSchema.value, findingsSchema.value, orderedDocument(report) as Json, "", errors);
  if (errors.length > 0) {
    return report.degraded(`self-validation against deep-spec-findings-schema.json failed: ${errors[0]}`);
  }
  return report;
}

// 書かれた Json を型付き状態へ解いて集約を再構成する。集約として成立しない
// 形は材料つきで拒否する（Repository が corrupt に写す）。
export function parseReportDocument(
  id: ReferenceCheckReportId,
  raw: Json,
): Result<ReferenceCheckReport, { cause: string }> {
  if (!isObject(raw)) return { ok: false, error: { cause: "document is not a JSON object" } };
  if (raw.backend !== id.backendName()) {
    return { ok: false, error: { cause: `document backend "${String(raw.backend)}" does not match the id backend "${id.backendName()}"` } };
  }
  if (!Array.isArray(raw.findings) || !Array.isArray(raw.skipped) || !Array.isArray(raw.inputs) || !Array.isArray(raw.checked)) {
    return { ok: false, error: { cause: "document lacks inputs/checked/findings/skipped arrays" } };
  }
  const unavailable = isObject(raw.unavailable) && typeof raw.unavailable.reason === "string" ? raw.unavailable.reason : null;
  return {
    ok: true,
    value: ReferenceCheckReport.reconstitute({
      id,
      inputs: InputAnchors.of(
        (raw.inputs as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          return {
            artifact: typeof entry.artifact === "string" ? entry.artifact : "",
            sha256: ContentHash.reconstitute(typeof entry.sha256 === "string" ? entry.sha256 : ""),
          };
        }),
      ),
      checked: TargetIds.of((raw.checked as Json[]).filter((c): c is string => typeof c === "string")),
      findings: Findings.of(
        (raw.findings as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          const witness = isObject(entry.witness) ? entry.witness : {};
          const refs = Array.isArray(witness.refs)
            ? witness.refs.map((r) => {
                const rr = isObject(r) ? r : {};
                const out: WitnessRef = {
                  artifact: typeof rr.artifact === "string" ? rr.artifact : "",
                  element: typeof rr.element === "string" ? rr.element : "",
                };
                if (typeof rr.value === "string") out.value = rr.value;
                return out;
              })
            : [];
          const f: Finding = {
            kind: typeof entry.kind === "string" ? entry.kind : "",
            frRefs: FrRefs.of(Array.isArray(entry.frRefs) ? (entry.frRefs.filter((x) => typeof x === "string") as string[]) : []),
            targets: TargetIds.of(Array.isArray(entry.targets) ? (entry.targets.filter((x) => typeof x === "string") as string[]) : []),
            witness: { refs: WitnessRefs.of(refs) },
            detail: typeof entry.detail === "string" ? entry.detail : "",
          };
          if (typeof entry.unit === "string") f.unit = entry.unit;
          return f;
        }),
      ),
      skipped: Skips.of(
        (raw.skipped as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          const sk: Skipped = {
            target: typeof entry.target === "string" ? entry.target : "",
            reason: typeof entry.reason === "string" ? entry.reason : "",
          };
          if (typeof entry.detail === "string") sk.detail = entry.detail;
          if (typeof entry.unit === "string") sk.unit = entry.unit;
          return sk;
        }),
      ),
      unavailableReason: unavailable,
    }),
  };
}
