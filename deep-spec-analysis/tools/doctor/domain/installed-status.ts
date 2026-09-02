import type { ManifestEntry } from "./manifest-entry.ts";

// 台帳エントリの設置状態——presenter は在否と、エントリのパス・深刻度を問う。
// （#71 波27）
export class InstalledStatus {
  readonly #entry: ManifestEntry;
  readonly #present: boolean;

  private constructor(entry: ManifestEntry, present: boolean) {
    this.#entry = entry;
    this.#present = present;
  }

  static of(entry: ManifestEntry, present: boolean): InstalledStatus {
    return new InstalledStatus(entry, present);
  }

  entry(): ManifestEntry {
    return this.#entry;
  }

  isPresent(): boolean {
    return this.#present;
  }
}
