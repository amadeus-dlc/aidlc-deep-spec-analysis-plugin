import type { Result } from "@deep-spec-analysis/kernel-infrastructure";

// 正常なテスト材料の構築。失敗はテストを止める。
export function requireSuccess<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  return result.value;
}
