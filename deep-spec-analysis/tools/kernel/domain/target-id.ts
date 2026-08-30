// 名前空間付き target id の語彙。サニタイズ（safe）と、finding/checked
// ペイロードが運ぶ id 列のファーストクラスコレクションを所有する。
// 旧自由関数 safeTarget は TargetIds.safe に従属した（OOUI 裁定）。

import { idCompare, sortedUnique } from "./id-order.ts";

export class TargetIds {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): TargetIds {
    return new TargetIds([...values]);
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

  add(value: string): TargetIds {
    return new TargetIds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  // finding の targets 面の凍結正準形（一意化 + id 順）。
  sortedUniqueCanonically(): TargetIds {
    return new TargetIds(sortedUnique([...this.#values], idCompare));
  }

  joined(separator: string): string {
    return this.#values.join(separator);
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
