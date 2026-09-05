import { CheckSeverity } from "./check-severity.ts";
import { ArtifactPath } from "@deep-spec/kernel-domain";

// 設置台帳の 1 エントリ——harness 相対パスと、欠けたときの深刻度。
// （#71 波27）
export class ManifestEntry {
  readonly #rel: ArtifactPath;
  readonly #severity: CheckSeverity;

  private constructor(rel: string, severity: CheckSeverity) {
    this.#rel = ArtifactPath.of(rel);
    this.#severity = severity;
  }

  static error(rel: string): ManifestEntry {
    return new ManifestEntry(rel, CheckSeverity.error());
  }

  rel(): string {
    return this.#rel.asString();
  }

  severity(): CheckSeverity {
    return this.#severity;
  }
}
