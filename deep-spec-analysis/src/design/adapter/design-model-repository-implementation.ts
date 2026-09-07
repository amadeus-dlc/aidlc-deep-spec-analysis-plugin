// 設計形式モデルの実 Gateway 実装。形式モデル markdown から唯一の ```json
// fence を取り出し、寛容パースで DesignModel を再構成する。irHash（生 IR の
// 正準 JSON の sha256）はここで導出——正準化は形式知識。corrupt.cause の文言は
// 降格文書（golden 凍結）に逐語で載る。不在だけを not-found とし、
// 読取障害は原因を保持して io-failed へ変換する。

import { DesignModel, type DesignModelIdentifier } from "@deep-spec-analysis/design-domain";
import type { DesignModelRepository } from "@deep-spec-analysis/design-usecase";
import { extractFences, readArtifactBytes, writeFileAtomically } from "@deep-spec-analysis/kernel-adapter";
import { ContentHash } from "@deep-spec-analysis/kernel-domain";
import { canonicalStringify, err, type Json, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import { parseDesignModel } from "./design-model-parser.ts";

export class DesignModelRepositoryImplementation implements DesignModelRepository {
  findById(id: DesignModelIdentifier): Result<DesignModel, RepositoryError> {
    const modelPath = id.artifactPath().asString();
    // 原文は生バイト列で一度だけ読む（UTF-8 復号は解析専用）。
    const read = readArtifactBytes(modelPath);
    if (!read.ok) return err(read.error);
    const bytes = read.value;
    const md = Buffer.from(bytes).toString("utf-8");
    const fences = extractFences(md, "json");
    const body = fences.length === 1 ? (fences[0]?.body ?? null) : null;
    let raw: Json = null;
    try {
      raw = body === null ? null : (JSON.parse(body) as Json);
    } catch {
      raw = null;
    }
    if (raw === null) {
      return err({
        kind: "corrupt",
        path: modelPath,
        cause: "formal model does not contain exactly one readable ```json fence",
      });
    }
    const composition = parseDesignModel(raw);
    if (!composition.ok) {
      return err({ kind: "corrupt", path: modelPath, cause: composition.error });
    }
    return ok(
      DesignModel.compose({
        id,
        irHash: ContentHash.ofText(canonicalStringify(raw)),
        sourceDocument: bytes,
        ...composition.value,
      }),
    );
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(model: DesignModel): Result<void, RepositoryError> {
    const modelPath = model.id().artifactPath().asString();
    const bytes = model.sourceDocument();
    try {
      writeFileAtomically(modelPath, bytes);
      return ok(undefined);
    } catch (e) {
      return err({
        kind: "io-failed",
        operation: "write",
        path: modelPath,
        cause: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
