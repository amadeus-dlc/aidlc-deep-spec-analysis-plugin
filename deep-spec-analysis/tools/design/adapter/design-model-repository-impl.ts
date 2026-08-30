// 設計形式モデルの実 Gateway 実装。形式モデル markdown から唯一の ```json
// fence を取り出し、寛容パースで DesignModel を再構成する。irHash（生 IR の
// 正準 JSON の sha256）はここで導出——正準化は形式知識。corrupt.cause の文言は
// 降格文書（golden 凍結）に逐語で載る。旧 existsSync ゲートの「stat 失敗は
// 理由を問わず不在」も忠実に再現する（PR4 レビューの教訓）。

import { existsSync, readFileSync } from "node:fs";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { sha256 } from "../../kernel/domain/index.ts";
import { type Json, canonicalStringify, extractFences } from "../../kernel/adapter/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import { DesignModel, type DesignModelId } from "../domain/index.ts";
import type { AcquiredDesignModel, DesignModelRepository } from "../usecase/index.ts";
import { parseDesignModel } from "./design-model-parser.ts";

export class DesignModelRepositoryImpl implements DesignModelRepository {
  findById(id: DesignModelId): Result<AcquiredDesignModel, RepositoryError> {
    const modelPath = id.artifactPath().value();
    let md: string;
    try {
      md = readFileSync(modelPath, "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || !existsSync(modelPath)) {
        return err({ kind: "not-found", path: modelPath });
      }
      return err({ kind: "io-failed", operation: "read", path: modelPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const fences = extractFences(md, "json");
    const body = fences.length === 1 ? (fences[0]?.body ?? null) : null;
    let raw: Json = null;
    try {
      raw = body === null ? null : (JSON.parse(body) as Json);
    } catch {
      raw = null;
    }
    if (raw === null) {
      return err({ kind: "corrupt", path: modelPath, cause: "formal model does not contain exactly one readable ```json fence" });
    }
    const composition = parseDesignModel(raw);
    if (typeof composition === "string") {
      return err({ kind: "corrupt", path: modelPath, cause: composition });
    }
    return ok({ model: DesignModel.compose({ id, ...composition }), irHash: sha256(canonicalStringify(raw)) });
  }
}
