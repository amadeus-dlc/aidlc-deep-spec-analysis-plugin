// 設計形式モデルの実 Gateway 実装。形式モデル markdown から唯一の ```json
// fence を取り出し、寛容パースで DesignModel を再構成する。irHash（生 IR の
// 正準 JSON の sha256）はここで導出——正準化は形式知識。corrupt.cause の文言は
// 降格文書（golden 凍結）に逐語で載る。旧 existsSync ゲートの「stat 失敗は
// 理由を問わず不在」も忠実に再現する（PR4 レビューの教訓）。

import { existsSync, readFileSync } from "node:fs";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { ContentHash } from "@deep-spec/kernel-domain";
import { type Json, canonicalStringify, extractFences, writeFileAtomically } from "@deep-spec/kernel-adapter";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import { DesignModel, type DesignModelId } from "@deep-spec/design-domain";
import type { DesignModelRepository } from "@deep-spec/design-usecase";
import { parseDesignModel } from "./design-model-parser.ts";

export class DesignModelRepositoryImpl implements DesignModelRepository {
  findById(id: DesignModelId): Result<DesignModel, RepositoryError> {
    const modelPath = id.artifactPath().asString();
    // 原文は生バイト列で一度だけ読む（UTF-8 復号は解析専用）。
    let bytes: Buffer;
    try {
      bytes = readFileSync(modelPath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || !existsSync(modelPath)) {
        return err({ kind: "not-found", path: modelPath });
      }
      return err({ kind: "io-failed", operation: "read", path: modelPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const md = bytes.toString("utf-8");
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
    return ok(DesignModel.compose({ id, irHash: ContentHash.ofText(canonicalStringify(raw)), sourceDocument: new Uint8Array(bytes), ...composition }));
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(model: DesignModel): Result<void, RepositoryError> {
    const modelPath = model.id().artifactPath().asString();
    try {
      writeFileAtomically(modelPath, model.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: modelPath, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
