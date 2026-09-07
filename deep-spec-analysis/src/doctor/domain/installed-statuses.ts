import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { InstalledStatus } from "./installed-status.ts";

/** 台帳の各行の設置状態の列。行順は doctor stdout の凍結順そのもの。 */
export class InstalledStatuses
  extends FirstClassCollectionBase<InstalledStatus, InstalledStatuses>
  implements FirstClassCollection<InstalledStatus>
{
  readonly #values: readonly InstalledStatus[];

  private constructor(values: readonly InstalledStatus[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-installed-statuses");
  }

  static of(values: readonly InstalledStatus[]): InstalledStatuses {
    return new InstalledStatuses(values);
  }

  static empty(): InstalledStatuses {
    return new InstalledStatuses([]);
  }

  add(value: InstalledStatus): InstalledStatuses {
    return new InstalledStatuses([...this.#values, value]);
  }

  static parse(values: readonly InstalledStatus[]): Result<InstalledStatuses, ParseError> {
    return parseConstruction(() => new InstalledStatuses(values));
  }

  protected override rebuild(values: readonly InstalledStatus[]): InstalledStatuses {
    return InstalledStatuses.of(values);
  }

  override map(transform: (element: InstalledStatus) => InstalledStatus): InstalledStatuses {
    return this.mapTo(transform, InstalledStatuses.of);
  }

  override combine(other: InstalledStatuses): InstalledStatuses {
    return this.combineTo(other, InstalledStatuses.of);
  }

  override *[Symbol.iterator](): Iterator<InstalledStatus> {
    yield* this.#values;
  }

  // 境界: 描画専用。presenter が行ごとの Check へ落とす材料。
  toArray(): readonly InstalledStatus[] {
    return this.#values;
  }
}
