// 形式化の根拠となった requirements.md のゲートウェイ。集約 ID（記録ルート）
// から記録配下を探索してバイトを読み、use-case へは id 集合とダイジェスト
// だけを渡す。
//
// ダイジェストは「読んだバイト列そのもの」の sha256（ContentHash.ofBytes）。
// ofText は文字列を UTF-8 で符号化し直すため、不正なバイト列を含むファイルで
// 結果がずれる。sourceDigest は観測面（凍結文言に載る）なので Buffer で採る。
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の findRequirementsFile ＋ source
// anchoring 節からの逐語移植（記録ルートの導出は材料ゲートウェイ側へ移動）。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ContentHash, RequirementIds } from "../../kernel/domain/index.ts";
import type { RequirementsSourceId } from "../domain/index.ts";
import type { RequirementsSource, RequirementsSourceRepository } from "../usecase/index.ts";

function findRequirementsFile(recordDir: string): string | null {
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
  findById(id: RequirementsSourceId): RequirementsSource | null {
    const path = findRequirementsFile(id.recordRoot().value());
    if (path === null) return null;
    const bytes = readFileSync(path);
    return {
      knownIds: RequirementIds.extractFrom(bytes.toString("utf-8")),
      digest: ContentHash.ofBytes(bytes).value(),
    };
  }
}
