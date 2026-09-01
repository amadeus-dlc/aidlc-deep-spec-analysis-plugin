import type { ManifestEntry } from "./manifest-entry.ts";

// マニフェスト 1 件の実在判定（ゲートウェイの existsSync 結果）。
export interface InstalledStatus {
  entry: ManifestEntry;
  present: boolean;
}
