// センサー verdict 行の描画（旧 verdictOut の純粋部分）。stdout への書込と
// process.exit は合成ルート（entry）の責務——層構造のファイルは process を
// 触らない。行の形はセンサー契約の凍結観測面（バイト単位）。

import type { Json } from "@deep-spec/kernel-infrastructure";

export function renderVerdictLine(pass: boolean, findings: number, skipped: number, note?: string): string {
  const out: { [k: string]: Json } = { pass, findings_count: findings, skipped_count: skipped, method: "static" };
  if (note) out.note = note;
  return `${JSON.stringify(out)}\n`;
}
