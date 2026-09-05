// JSON の形を復号する境界。欠損・型不一致を空の検査結果へ補完しない。
// kind / method / reason の語彙の適合はドメイン側に残し、未知の文字列も逐語で運ぶ。
import { type Json, type Result, err, isObject, ok } from "@deep-spec/kernel-infrastructure";

export interface FindingsDocument {
  backend: string;
  irVersion: string;
  irHash: string;
  method: string;
  findings: { kind: string; frRefs: string[]; targets: string[]; witness: Json; detail: string; unit?: string }[];
  skipped: { target: string; reason: string; detail?: string; unit?: string }[];
  unavailable?: { reason: string };
  inputs?: { artifact: string; sha256: string }[];
  checked?: string[];
  crossChecked?: { backend: string; targets: string[] }[];
}

const strings = (value: Json | undefined): boolean => Array.isArray(value) && value.every((v) => typeof v === "string");
const optionalString = (value: Json | undefined): boolean => value === undefined || typeof value === "string";

export function decodeFindingsDocument(raw: Json): Result<FindingsDocument, string> {
  if (!isObject(raw)) return err("findings document must be an object");
  for (const field of ["backend", "irVersion", "irHash", "method"]) {
    if (typeof raw[field] !== "string") return err(`${field} must be a string`);
  }
  if (!Array.isArray(raw.findings) || !raw.findings.every((f) =>
    isObject(f) && typeof f.kind === "string" && strings(f.frRefs) && strings(f.targets) &&
    isObject(f.witness) && typeof f.detail === "string" && optionalString(f.unit))) {
    return err("findings must be an array of complete finding records");
  }
  if (!Array.isArray(raw.skipped) || !raw.skipped.every((s) =>
    isObject(s) && typeof s.target === "string" && typeof s.reason === "string" &&
    optionalString(s.detail) && optionalString(s.unit))) {
    return err("skipped must be an array of complete skip records");
  }
  if (raw.unavailable !== undefined && (!isObject(raw.unavailable) || typeof raw.unavailable.reason !== "string")) {
    return err("unavailable must carry a reason");
  }
  if (raw.inputs !== undefined && (!Array.isArray(raw.inputs) || !raw.inputs.every((i) =>
    isObject(i) && typeof i.artifact === "string" && typeof i.sha256 === "string"))) {
    return err("inputs must be an array of input anchors");
  }
  if (raw.checked !== undefined && !strings(raw.checked)) return err("checked must be an array of strings");
  if (raw.crossChecked !== undefined && (!Array.isArray(raw.crossChecked) || !raw.crossChecked.every((c) =>
    isObject(c) && typeof c.backend === "string" && strings(c.targets)))) {
    return err("crossChecked must be an array of backend comparisons");
  }
  // 外部 JSON から型付き文書になる唯一のキャスト。上の検査では要素を除去しない。
  return ok(raw as unknown as FindingsDocument);
}
