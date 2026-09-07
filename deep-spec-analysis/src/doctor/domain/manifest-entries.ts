import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ManifestEntry } from "./manifest-entry.ts";

/** インストール台帳の項目列。選択結果として空になることを許す。 */
export class ManifestEntries
  extends FirstClassCollectionBase<ManifestEntry, ManifestEntries>
  implements FirstClassCollection<ManifestEntry>
{
  readonly #entries: readonly ManifestEntry[];

  private constructor(entries: readonly ManifestEntry[]) {
    super();
    this.#entries = boundedCollectionSnapshot(entries, 65_536, "too-many-manifest-entries");
  }

  static of(entries: readonly ManifestEntry[]): ManifestEntries {
    return new ManifestEntries(entries);
  }

  static parse(entries: readonly ManifestEntry[]): Result<ManifestEntries, ParseError> {
    return parseConstruction(() => new ManifestEntries(entries));
  }

  protected override rebuild(values: readonly ManifestEntry[]): ManifestEntries {
    return ManifestEntries.of(values);
  }

  override map(transform: (element: ManifestEntry) => ManifestEntry): ManifestEntries {
    return this.mapTo(transform, ManifestEntries.of);
  }

  override combine(other: ManifestEntries): ManifestEntries {
    return this.combineTo(other, ManifestEntries.of);
  }

  override *[Symbol.iterator](): Iterator<ManifestEntry> {
    yield* this.#entries;
  }
}
