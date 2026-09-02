import type { CheckSeverity } from "./check-severity.ts";

// 設置台帳の 1 エントリ——harness 相対パスと、欠けたときの深刻度。
// （#71 波27）
export class ManifestEntry {
  readonly #rel: string;
  readonly #severity: CheckSeverity;

  private constructor(rel: string, severity: CheckSeverity) {
    this.#rel = rel;
    this.#severity = severity;
  }

  static error(rel: string): ManifestEntry {
    return new ManifestEntry(rel, "error");
  }

  rel(): string {
    return this.#rel;
  }

  severity(): CheckSeverity {
    return this.#severity;
  }
}
