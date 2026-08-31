// 原子的ファイル書き込み — 同一ディレクトリの一時ファイルへ書いてから
// rename で置換する（POSIX の rename は同一ファイルシステム内で原子的）。
// 書込み途中の I/O 失敗で既存成果物が部分内容に切り詰められることを防ぐ。
// 失敗時は一時ファイルを掃除してから投げ直す（呼び手が RepositoryError へ
// 写像する）。

import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// 一時名の一意性材料（process.* はエントリ専用——層規律）。
let sequence = 0;

export function writeFileAtomically(path: string, data: Uint8Array): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  sequence += 1;
  const tmp = join(dir, `.${basename(path)}.tmp-${Date.now().toString(36)}-${sequence.toString(36)}`);
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  } catch (e) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // 掃除失敗は元例外を優先する。
    }
    throw e;
  }
}
