import {type Result, err, parseConstruction} from "@deep-spec/kernel-infrastructure";

// 複合文書のparse境界。constructorの入力契約違反だけを診断に変換する。
// TypeError等の実装不具合は parseConstruction が送出し続ける。
export function decodeDomainValues<T>(build: () => T): Result<T, string> {
  const parsed = parseConstruction(build);
  return parsed.ok ? parsed : err(JSON.stringify(parsed.error));
}
