import { ErrorMessage, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { InstalledRelease } from "./installed-release.ts";
import type { PluginVersion } from "./plugin-version.ts";
import { VersionAdvisory } from "./version-advisory.ts";

// stable版だけを内包する。文字列tagの解釈は取得adapter、最新版の選択はこの集合が所有。
export class StableReleases extends FirstClassCollectionBase<PluginVersion, StableReleases> {
  readonly #versions: readonly PluginVersion[];
  /** GitHub取得ポートの上限100ページ×100件と同じ10,000版。 */
  private constructor(versions: readonly PluginVersion[]) {
    super();
    this.#versions = boundedCollectionSnapshot(versions, 10_000, "too-many-stable-releases");
  }

  protected override rebuild(values: readonly PluginVersion[]): StableReleases {
    return new StableReleases(values);
  }

  override *[Symbol.iterator](): Iterator<PluginVersion> {
    yield* this.#versions;
  }
  static of(versions: readonly PluginVersion[]): StableReleases {
    return new StableReleases(versions);
  }
  override map(transform: (element: PluginVersion) => PluginVersion): StableReleases {
    return this.mapTo(transform, StableReleases.of);
  }

  override combine(other: StableReleases): StableReleases {
    return this.combineTo(other, StableReleases.of);
  }

  static parse(versions: readonly PluginVersion[]): Result<StableReleases, ParseError> {
    return parseConstruction(() => new StableReleases(versions));
  }
  advise(installed: InstalledRelease): VersionAdvisory {
    let latest: PluginVersion | null = null;
    for (const version of this.#versions) if (latest === null || latest.isOlderThan(version)) latest = version;
    return latest === null
      ? VersionAdvisory.skipped(installed, ErrorMessage.of("GitHub returned no stable Semantic Versioning tag"))
      : installed.assessLatest(latest);
  }
}
