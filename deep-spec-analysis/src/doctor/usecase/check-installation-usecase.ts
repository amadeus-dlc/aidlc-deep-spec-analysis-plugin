import { InstallationManifest, InstalledStatus } from "@deep-spec/doctor-domain";
import type { HarnessFileClient } from "./port/harness-file-client.ts";

// マニフェスト全行の実在判定（checks 配列の先頭ブロック——凍結順）。
export class CheckInstallationUseCase {
  readonly #files: HarnessFileClient;

  constructor(files: HarnessFileClient) {
    this.#files = files;
  }

  execute(): readonly InstalledStatus[] {
    const out: InstalledStatus[] = [];
    for (const entry of InstallationManifest.standard()) {
      out.push(InstalledStatus.of(entry, this.#files.isInstalled(entry)));
    }
    return out;
  }
}
