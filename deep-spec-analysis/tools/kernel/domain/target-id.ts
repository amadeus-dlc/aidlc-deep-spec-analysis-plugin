// 検査対象 id（target）の語彙。finding・skip・checked が集約をまたいで指す
// id——要件の義務／シナリオ、設計の宣言、BR、名前空間付きトークン——で、
// findings スキーマの targetId 定義が唯一の強い不変条件（parse が検証する）。
// 凍結文書と生 id 材料の再構成は reconstitute（逐語）。正準順序（英字骨格→
// 数値セグメント）は id 自身が所有し、比較器は IdOrder に従属する（#71 波10）。

import { type Result, err, ok } from "../infrastructure/index.ts";
import { IdOrder } from "./id-order.ts";

type TargetIdError = { readonly kind: "malformed-target-id"; readonly raw: string };

// deep-spec-findings-schema.json の definitions.targetId と同値。
const TARGET_ID_PATTERNS: readonly RegExp[] = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/,
];

export class TargetId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<TargetId, TargetIdError> {
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw))) return err({ kind: "malformed-target-id", raw });
    return ok(new TargetId(raw));
  }

  static reconstitute(raw: string): TargetId {
    return new TargetId(raw);
  }

  equals(other: TargetId): boolean {
    return this.#value === other.#value;
  }

  // 正準順序——skipped ソートと finding の targets 面（= golden バイト）を決める。
  compareTo(other: TargetId): number {
    return IdOrder.compare(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
