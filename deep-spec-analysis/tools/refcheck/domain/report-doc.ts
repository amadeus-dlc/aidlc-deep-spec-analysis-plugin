// 契約2 の refcheck 文書（組立前の形）と書込結果。deep-spec-lib.ts からの
// 逐語移動。PR2b で ReferenceCheckReport 集約（build() が組立＋自己検証＋
// 描画を所有）へ再モデル化予定。

import type { Finding } from "./finding.ts";
import type { InputEntry } from "./input-entry.ts";
import type { Skipped } from "./skipped.ts";

export interface RefcheckDoc {
  backend: string;
  unavailable?: { reason: string };
  inputs: InputEntry[];
  checked: string[];
  findings: Finding[];
  skipped: Skipped[];
}

export interface EmitResult {
  findingsCount: number;
  skippedCount: number;
  unavailable: boolean;
}
