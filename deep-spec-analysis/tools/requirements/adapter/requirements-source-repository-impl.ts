// 形式化の根拠となった requirements.md のゲートウェイ。記録ルート配下の探索と
// バイト読みを担い、use-case へは id 集合とダイジェストだけを渡す。
//
// ダイジェストは「読んだバイト列そのもの」の sha256 — kernel の sha256(text)
// は文字列を UTF-8 で符号化し直すため、不正なバイト列を含むファイルで結果が
// ずれる。sourceDigest は観測面（凍結文言に載る）なので Buffer のまま採る。
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の findRequirementsFile ＋ source
// anchoring 節からの逐語移植。

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { requirementIds } from "../../kernel/domain/index.ts";
import type { RequirementsSource, RequirementsSourceRepository } from "../usecase/index.ts";

// <record>/<phase>/<stage>/deep-spec-analysis-formal-model.md → <record> は 3 階層上。
function findRequirementsFile(outputPath: string): string | null {
  const recordDir = dirname(dirname(dirname(outputPath)));
  const direct = join(recordDir, "inception", "requirements-analysis", "requirements.md");
  if (existsSync(direct)) return direct;
  try {
    for (const phase of readdirSync(recordDir).sort()) {
      const candidate = join(recordDir, phase, "requirements-analysis", "requirements.md");
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // recordDir が読めない — null へ落とす。
  }
  return null;
}

export class RequirementsSourceRepositoryImpl implements RequirementsSourceRepository {
  resolve(outputPath: string): RequirementsSource | null {
    const path = findRequirementsFile(outputPath);
    if (path === null) return null;
    const bytes = readFileSync(path);
    return {
      knownIds: requirementIds(bytes.toString("utf-8")),
      digest: createHash("sha256").update(bytes).digest("hex"),
    };
  }
}
