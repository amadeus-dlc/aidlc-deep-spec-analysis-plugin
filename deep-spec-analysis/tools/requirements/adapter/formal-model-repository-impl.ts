// FormalModelRepository の実 Gateway 実装。形式モデル markdown から唯一の
// ```json fence を取り出し、寛容パースで RequirementsModel を再構成する。
// irHash（生 IR の正準 JSON の sha256）はここで導出——正準化は形式知識。
// corrupt.cause の文言は降格文書（golden 凍結）に逐語で載る。

import { existsSync, readFileSync } from "node:fs";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { sha256 } from "../../kernel/domain/index.ts";
import { type Json, canonicalStringify, extractFences } from "../../kernel/adapter/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import { type FormalModelId, RequirementsModel } from "../domain/index.ts";
import type { AcquiredFormalModel, FormalModelRepository } from "../usecase/index.ts";
import { parseFormalModel } from "./formal-model-parser.ts";

export class FormalModelRepositoryImpl implements FormalModelRepository {
  findById(id: FormalModelId): Result<AcquiredFormalModel, RepositoryError> {
    const modelPath = id.artifactPath().value();
    let md: string;
    try {
      md = readFileSync(modelPath, "utf-8");
    } catch (e) {
      // 旧 entry ゲートの existsSync は stat 失敗を理由を問わず「不在」に
      // 潰していた（親ディレクトリの権限拒否も NA）。忠実に再現する：
      // stat が通らないパスは not-found、stat が通るのに読めないパスだけが
      // io-failed（旧実装ではクラッシュ exit 1 だった経路）。
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || !existsSync(modelPath)) {
        return err({ kind: "not-found", path: modelPath });
      }
      return err({ kind: "io-failed", operation: "read", path: modelPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const fences = extractFences(md, "json");
    const body = fences.length === 1 ? (fences[0]?.body ?? null) : null;
    let rawIr: Json = null;
    try {
      rawIr = body === null ? null : (JSON.parse(body) as Json);
    } catch {
      rawIr = null;
    }
    if (rawIr === null) {
      return err({ kind: "corrupt", path: modelPath, cause: "formal model does not contain exactly one readable ```json fence" });
    }
    const seed = parseFormalModel(rawIr);
    if (typeof seed === "string") {
      return err({ kind: "corrupt", path: modelPath, cause: seed });
    }
    return ok({ model: RequirementsModel.reconstitute({ id, ...seed }), irHash: sha256(canonicalStringify(rawIr)) });
  }
}
