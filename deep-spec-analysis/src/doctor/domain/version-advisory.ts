import type { ErrorMessage } from "@deep-spec/kernel-domain";
import type { InstalledRelease } from "./installed-release.ts";
import type { PluginVersion } from "./plugin-version.ts";

type VersionAdvisoryVariant =
  | { kind: "current" | "update-available"; installed: InstalledRelease; latest: PluginVersion }
  | { kind: "skipped"; installed: InstalledRelease; reason: ErrorMessage }
  | { kind: "provenance-missing" }
  | { kind: "provenance-malformed"; reason: ErrorMessage };

// 導入版の更新査定。表示文言とバージョンの文字列表現を保持しない。
export class VersionAdvisory {
  readonly #variant: VersionAdvisoryVariant;
  private constructor(variant: VersionAdvisoryVariant) {
    this.#variant = Object.freeze({ ...variant });
  }
  static current(installed: InstalledRelease, latest: PluginVersion): VersionAdvisory {
    return new VersionAdvisory({ kind: "current", installed, latest });
  }
  static updateAvailable(installed: InstalledRelease, latest: PluginVersion): VersionAdvisory {
    return new VersionAdvisory({ kind: "update-available", installed, latest });
  }
  static skipped(installed: InstalledRelease, reason: ErrorMessage): VersionAdvisory {
    return new VersionAdvisory({ kind: "skipped", installed, reason });
  }
  static provenanceMissing(): VersionAdvisory {
    return new VersionAdvisory({ kind: "provenance-missing" });
  }
  static provenanceMalformed(reason: ErrorMessage): VersionAdvisory {
    return new VersionAdvisory({ kind: "provenance-malformed", reason });
  }
  match<T>(cases: {
    current: (installed: InstalledRelease, latest: PluginVersion) => T;
    updateAvailable: (installed: InstalledRelease, latest: PluginVersion) => T;
    skipped: (installed: InstalledRelease, reason: ErrorMessage) => T;
    provenanceMissing: () => T;
    provenanceMalformed: (reason: ErrorMessage) => T;
  }): T {
    const variant = this.#variant;
    if (variant.kind === "provenance-missing") return cases.provenanceMissing();
    if (variant.kind === "provenance-malformed") return cases.provenanceMalformed(variant.reason);
    if (variant.kind === "skipped") return cases.skipped(variant.installed, variant.reason);
    return variant.kind === "current"
      ? cases.current(variant.installed, variant.latest)
      : cases.updateAvailable(variant.installed, variant.latest);
  }
}
