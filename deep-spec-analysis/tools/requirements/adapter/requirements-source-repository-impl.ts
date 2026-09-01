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
import { writeFileAtomically } from "../../kernel/adapter/index.ts";
import { ArtifactPath, ContentHash, RequirementIds } from "../../kernel/domain/index.ts";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import { RequirementsSource, type RequirementsSourceId } from "../domain/index.ts";
import type { RequirementsSourceRepository } from "../usecase/index.ts";

type RequirementsFileSearch =
  | { readonly kind: "found"; readonly path: string }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly cause: string };

function findRequirementsFile(recordDir: string): RequirementsFileSearch {
  const direct = join(recordDir, "inception", "requirements-analysis", "requirements.md");
  if (existsSync(direct)) return { kind: "found", path: direct };
  // 記録ルート自体の不在は「読取障害」ではなく不在（not-found の凍結分類）。
  if (!existsSync(recordDir)) return { kind: "absent" };
  try {
    for (const phase of readdirSync(recordDir).sort()) {
      const candidate = join(recordDir, phase, "requirements-analysis", "requirements.md");
      if (existsSync(candidate)) return { kind: "found", path: candidate };
    }
  } catch (e) {
    // recordDir が読めない——不在ではなく読取障害として区別する（use case の
    // verdict 写像は同一だが、Result 契約の分類を正しく保つ）。
    return { kind: "unreadable", cause: e instanceof Error ? e.message : String(e) };
  }
  return { kind: "absent" };
}

export class RequirementsSourceRepositoryImpl implements RequirementsSourceRepository {
  findById(id: RequirementsSourceId): Result<RequirementsSource, RepositoryError> {
    const search = findRequirementsFile(id.recordRoot().asString());
    if (search.kind === "unreadable") {
      return err({ kind: "io-failed", operation: "read", path: id.recordRoot().asString(), cause: search.cause });
    }
    if (search.kind === "absent") return err({ kind: "not-found", path: id.recordRoot().asString() });
    try {
      const bytes = readFileSync(search.path);
      return ok(
        RequirementsSource.reconstitute({
          id,
          sourcePath: ArtifactPath.reconstitute(search.path),
          knownIds: RequirementIds.extractFrom(bytes.toString("utf-8")),
          digest: ContentHash.ofBytes(bytes).asString(),
          sourceDocument: new Uint8Array(bytes),
        }),
      );
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: search.path, cause: e instanceof Error ? e.message : String(e) });
    }
  }

  // 往復則: findById が読んだ原文バイト列を解決済みの所在へ逐語で書き戻す。
  store(source: RequirementsSource): Result<void, RepositoryError> {
    const path = source.sourcePath().asString();
    try {
      writeFileAtomically(path, source.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
