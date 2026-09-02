// finding / checked / crossChecked ペイロードが運ぶ target id 列のファースト
// クラスコレクション。要素は TargetId（#71 波10——生 string の集合ではない）。
// of は DP の門、reconstitute は凍結文書と生 id 材料からの逐語再構成。
// 名前空間付き id のサニタイズ（safe）は refcheck レポートの材料面として残る
// （旧自由関数 safeTarget は TargetIds.safe に従属した——OOUI 裁定）。

import { sortedUniqueCanonically } from "./canonical-order.ts";
import { TargetId } from "./target-id.ts";

export class TargetIds {
  readonly #values: readonly TargetId[];

  private constructor(values: readonly TargetId[]) {
    this.#values = values;
  }

  static of(values: readonly TargetId[]): TargetIds {
    return new TargetIds([...values]);
  }

  // 凍結文書・生 id 材料からの逐語再構成。
  static reconstitute(values: readonly string[]): TargetIds {
    return new TargetIds(values.map((v) => TargetId.reconstitute(v)));
  }

  // Namespaced target ids (unit:…, component:…, entity:…) must satisfy the
  // findings schema's targetId pattern, but the raw names they are built from
  // come out of free-form artifact text (a markdown table cell, a yaml scalar)
  // and may carry spaces or other out-of-alphabet characters. Sanitize the
  // token deterministically — the raw string always survives in the witness
  // refs `value` — so a defective name can never invalidate the whole document.
  static safe(prefix: string, raw: string): string {
    const token = raw.replace(/[^A-Za-z0-9_./-]/g, "-");
    return `${prefix}:${token === "" ? "unknown" : token}`;
  }

  add(value: TargetId): TargetIds {
    return new TargetIds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<TargetId> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  includes(value: TargetId): boolean {
    return this.#values.some((v) => v.equals(value));
  }

  // value と等しい id を除いた列（順序は保つ）。refcheck レポートが
  // finding／skip の family を checked から外す不変条件の材料。
  excluding(value: TargetId): TargetIds {
    return new TargetIds(this.#values.filter((v) => !v.equals(value)));
  }

  // id 順のみ（一意化しない——重複を保つ面の凍結順）。
  sortedCanonically(): TargetIds {
    return new TargetIds([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  // finding の targets 面の凍結正準形（一意化 + id 順）。
  sortedUniqueCanonically(): TargetIds {
    return TargetIds.reconstitute(sortedUniqueCanonically(this.toStrings()));
  }

  joined(separator: string): string {
    return this.toStrings().join(separator);
  }

  toArray(): readonly TargetId[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ・生 id 材料専用。
  toStrings(): string[] {
    return this.#values.map((v) => v.asString());
  }
}
