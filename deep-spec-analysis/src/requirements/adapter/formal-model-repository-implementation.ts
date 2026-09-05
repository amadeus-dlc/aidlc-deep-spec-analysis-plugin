// FormalModelRepository の実 Gateway 実装。形式モデル markdown から唯一の
// ```json fence を取り出し、寛容パースで RequirementsModel を再構成する。
// irHash（生 IR の正準 JSON の sha256）はここで導出——正準化は形式知識。
// corrupt.cause の文言は降格文書（golden 凍結）に逐語で載る。

import { existsSync, readFileSync } from "node:fs";
import { extractFences, writeFileAtomically } from "@deep-spec/kernel-adapter";
import { ContentHash } from "@deep-spec/kernel-domain";
import { canonicalStringify, err, type Json, ok, type Result } from "@deep-spec/kernel-infrastructure";

import type { RepositoryError } from "@deep-spec/kernel-usecase";
import { type FormalModelIdentifier, RequirementsModel } from "@deep-spec/requirements-domain";
import type { FormalModelRepository } from "@deep-spec/requirements-usecase";
import { parseFormalModel } from "./formal-model-parser.ts";

export class FormalModelRepositoryImplementation implements FormalModelRepository {
  findById(id: FormalModelIdentifier): Result<RequirementsModel, RepositoryError> {
    const modelPath = id.artifactPath().asString();
    // 原文は生バイト列で一度だけ読む（UTF-8 復号は解析専用——store の往復則は
    // バイト列で守る）。
    let bytes: Buffer;
    try {
      bytes = readFileSync(modelPath);
    } catch (e) {
      // 旧 entry ゲートの existsSync は stat 失敗を理由を問わず「不在」に
      // 潰していた（親ディレクトリの権限拒否も NA）。忠実に再現する：
      // stat が通らないパスは not-found、stat が通るのに読めないパスだけが
      // io-failed（旧実装ではクラッシュ exit 1 だった経路）。
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || !existsSync(modelPath)) {
        return err({ kind: "not-found", path: modelPath });
      }
      return err({
        kind: "io-failed",
        operation: "read",
        path: modelPath,
        cause: e instanceof Error ? e.message : String(e),
      });
    }
    const md = bytes.toString("utf-8");
    const fences = extractFences(md, "json");
    const body = fences.length === 1 ? (fences[0]?.body ?? null) : null;
    let rawIr: Json = null;
    try {
      rawIr = body === null ? null : (JSON.parse(body) as Json);
    } catch {
      rawIr = null;
    }
    if (rawIr === null) {
      return err({
        kind: "corrupt",
        path: modelPath,
        cause: "formal model does not contain exactly one readable ```json fence",
      });
    }
    const seed = parseFormalModel(rawIr);
    if (!seed.ok) {
      return err({ kind: "corrupt", path: modelPath, cause: seed.error });
    }
    return ok(
      RequirementsModel.of({
        id,
        irHash: ContentHash.ofText(canonicalStringify(rawIr)),
        sourceDocument: new Uint8Array(bytes),
        ...seed.value,
      }),
    );
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(model: RequirementsModel): Result<void, RepositoryError> {
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
