import type { ErrorMessage } from "@deep-spec/kernel-domain";
import type { InstalledRelease } from "./installed-release.ts";
import type { StableReleases } from "./stable-releases.ts";
import { VersionAdvisory } from "./version-advisory.ts";

type ReleaseCatalogVariant =
  | { kind: "available"; releases: StableReleases }
  | { kind: "unavailable"; reason: ErrorMessage };

export class ReleaseCatalog {
  readonly #variant: ReleaseCatalogVariant;
  private constructor(variant: ReleaseCatalogVariant) {
    this.#variant = Object.freeze({ ...variant });
  }
  static available(releases: StableReleases): ReleaseCatalog {
    return new ReleaseCatalog({ kind: "available", releases });
  }
  static unavailable(reason: ErrorMessage): ReleaseCatalog {
    return new ReleaseCatalog({ kind: "unavailable", reason });
  }
  advise(installed: InstalledRelease): VersionAdvisory {
    return this.#variant.kind === "available"
      ? this.#variant.releases.advise(installed)
      : VersionAdvisory.skipped(installed, this.#variant.reason);
  }
}
