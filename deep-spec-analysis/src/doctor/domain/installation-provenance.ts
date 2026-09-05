import type { ErrorMessage } from "@deep-spec/kernel-domain";
import type { InstalledRelease } from "./installed-release.ts";
import { VersionAdvisory } from "./version-advisory.ts";

type InstallationProvenanceVariant =
  | { kind: "installed"; release: InstalledRelease }
  | { kind: "unavailable"; advisory: VersionAdvisory };

// 来歴の有効性を所有し、照会不能時の査定も自身から返す。
export class InstallationProvenance {
  readonly #variant: InstallationProvenanceVariant;
  private constructor(variant: InstallationProvenanceVariant) {
    this.#variant = Object.freeze({ ...variant });
  }
  static installed(release: InstalledRelease): InstallationProvenance {
    return new InstallationProvenance({ kind: "installed", release });
  }
  static missing(): InstallationProvenance {
    return new InstallationProvenance({ kind: "unavailable", advisory: VersionAdvisory.provenanceMissing() });
  }
  static malformed(reason: ErrorMessage): InstallationProvenance {
    return new InstallationProvenance({ kind: "unavailable", advisory: VersionAdvisory.provenanceMalformed(reason) });
  }
  match<T>(cases: { installed: (release: InstalledRelease) => T; unavailable: (advisory: VersionAdvisory) => T }): T {
    return this.#variant.kind === "installed"
      ? cases.installed(this.#variant.release)
      : cases.unavailable(this.#variant.advisory);
  }
}
