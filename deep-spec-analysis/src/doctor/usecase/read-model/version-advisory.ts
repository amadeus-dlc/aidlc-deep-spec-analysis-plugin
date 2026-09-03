// doctor presenter のための version 照会結果。表示用の投影なので domain では
// なく query/usecase 層に置く（リードモデル規律）。
type VersionAdvisoryVariant =
  | { readonly kind: "current" | "update-available"; readonly installedVersion: string; readonly latestVersion: string; readonly source: string; readonly ref: string }
  | { readonly kind: "skipped"; readonly installedVersion: string; readonly source: string; readonly ref: string; readonly reason: string }
  | { readonly kind: "provenance-missing" }
  | { readonly kind: "provenance-malformed"; readonly reason: string };

export class VersionAdvisory {
  readonly #variant: VersionAdvisoryVariant;

  private constructor(variant: VersionAdvisoryVariant) {
    this.#variant = variant;
  }

  static current(props: { installedVersion: string; latestVersion: string; source: string; ref: string }): VersionAdvisory {
    return new VersionAdvisory({ kind: "current", ...props });
  }

  static updateAvailable(props: { installedVersion: string; latestVersion: string; source: string; ref: string }): VersionAdvisory {
    return new VersionAdvisory({ kind: "update-available", ...props });
  }

  static skipped(props: { installedVersion: string; source: string; ref: string; reason: string }): VersionAdvisory {
    return new VersionAdvisory({ kind: "skipped", ...props });
  }

  static provenanceMissing(): VersionAdvisory {
    return new VersionAdvisory({ kind: "provenance-missing" });
  }

  static provenanceMalformed(reason: string): VersionAdvisory {
    return new VersionAdvisory({ kind: "provenance-malformed", reason });
  }

  match<T>(cases: {
    current: (values: { installedVersion: string; latestVersion: string; source: string; ref: string }) => T;
    updateAvailable: (values: { installedVersion: string; latestVersion: string; source: string; ref: string }) => T;
    skipped: (values: { installedVersion: string; source: string; ref: string; reason: string }) => T;
    provenanceMissing: () => T;
    provenanceMalformed: (reason: string) => T;
  }): T {
    const variant = this.#variant;
    if (variant.kind === "provenance-missing") return cases.provenanceMissing();
    if (variant.kind === "provenance-malformed") return cases.provenanceMalformed(variant.reason);
    if (variant.kind === "skipped") return cases.skipped(variant);
    return variant.kind === "update-available" ? cases.updateAvailable(variant) : cases.current(variant);
  }
}
