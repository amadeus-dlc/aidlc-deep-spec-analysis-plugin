import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ManifestEntry } from "@deep-spec/doctor-domain";
import type { HarnessFileClient } from "@deep-spec/doctor-usecase";

// マニフェスト実在検査の実 Gateway——harness ルート相対の existsSync。
export class HarnessFileClientImplementation implements HarnessFileClient {
  readonly #root: string;

  constructor(config: { root: string }) {
    this.#root = config.root;
  }

  isInstalled(entry: ManifestEntry): boolean {
    return existsSync(join(this.#root, entry.rel()));
  }
}
