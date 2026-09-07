import type { FirstClassCollection } from "./first-class-collection.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";
// finding / checked / crossChecked ペイロードが運ぶ target id 列のファースト
// クラスコレクション。要素は TargetIdentifier（#71 波10——生 string の集合ではない）。
// of は型付きの TargetIdentifier を受け取る。
// 名前空間付き id のサニタイズ（safe）は refcheck レポートの材料面として残る
// （旧自由関数 safeTarget は TargetIdentifiers.safe に従属した——OOUI 裁定）。

import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
  sortedUniqueCanonically,
} from "@deep-spec-analysis/kernel-infrastructure";
import { TargetIdentifier } from "./target-identifier.ts";

const MAX_TARGET_IDENTIFIERS = 65_536;

export class TargetIdentifiers
  extends FirstClassCollectionBase<TargetIdentifier, TargetIdentifiers>
  implements FirstClassCollection<TargetIdentifier>
{
  readonly #values: readonly TargetIdentifier[];

  private constructor(values: readonly TargetIdentifier[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_TARGET_IDENTIFIERS, "too-many-target-identifiers");
  }

  protected override rebuild(values: readonly TargetIdentifier[]): TargetIdentifiers {
    return new TargetIdentifiers(values);
  }

  static of(values: readonly TargetIdentifier[]): TargetIdentifiers {
    return new TargetIdentifiers(values);
  }

  override map(transform: (element: TargetIdentifier) => TargetIdentifier): TargetIdentifiers {
    return this.mapTo(transform, TargetIdentifiers.of);
  }

  override combine(other: TargetIdentifiers): TargetIdentifiers {
    return this.combineTo(other, TargetIdentifiers.of);
  }

  static parse(values: readonly TargetIdentifier[]): Result<TargetIdentifiers, ParseError> {
    return parseConstruction(() => new TargetIdentifiers(values));
  }

  // 凍結文書・生 id 材料からの逐語再構成。
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

  add(value: TargetIdentifier): TargetIdentifiers {
    return new TargetIdentifiers([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<TargetIdentifier> {
    yield* this.#values;
  }

  override count(): number {
    return this.#values.length;
  }

  // value と等しい id を除いた列（順序は保つ）。refcheck レポートが
  // finding／skip の family を checked から外す不変条件の材料。
  excluding(value: TargetIdentifier): TargetIdentifiers {
    return new TargetIdentifiers(this.#values.filter((v) => !v.equals(value)));
  }

  // id 順のみ（一意化しない——重複を保つ面の凍結順）。
  sortedCanonically(): TargetIdentifiers {
    return new TargetIdentifiers([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  // checked / crossChecked の対象列を一意化し、id順に並べる。
  sortedUniqueCanonically(): TargetIdentifiers {
    return TargetIdentifiers.of(
      Array.from(sortedUniqueCanonically(this.toStrings()), (raw) => TargetIdentifier.of(raw)),
    );
  }

  joined(separator: string): string {
    return this.toStrings().join(separator);
  }

  toArray(): readonly TargetIdentifier[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ・生 id 材料専用。
  toStrings(): string[] {
    return this.#values.map((v) => v.asString());
  }

  override isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
