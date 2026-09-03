// ディレクトリ直下のサブディレクトリ名（ソート済み）。読めなければ空。
// 合成ルートの入力取得（構築ユニットの列挙）用の fs プリミティブ。

import { readdirSync } from "node:fs";

export function listSubdirectories(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}
