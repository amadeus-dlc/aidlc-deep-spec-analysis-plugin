// RefinementMapRepository の実 Gateway 実装。契約4 文書の解釈は composite
// 取得面（refinement-materials-repository-impl）と共有パーサに一本化されており、
// corrupt.cause と absent(error) の凍結文言は常に一致する。

import { existsSync, readFileSync } from "node:fs";
import { writeFileAtomically } from "@deep-spec/kernel-adapter";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { RefinementMap, RefinementMapId } from "@deep-spec/refinement-domain";
import type { RefinementMapRepository } from "@deep-spec/design-usecase";
import { parseRefinementMapDocument } from "./refinement-materials-repository-impl.ts";

export class RefinementMapRepositoryImpl implements RefinementMapRepository {
  readonly #mapSchemaPath: string;

  constructor(mapSchemaPath: string) {
    this.#mapSchemaPath = mapSchemaPath;
  }

  findById(id: RefinementMapId): Result<RefinementMap, RepositoryError> {
    const path = id.artifactPath().asString();
    if (!existsSync(path)) return err({ kind: "not-found", path });
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const parsed = parseRefinementMapDocument(new Uint8Array(bytes), id, this.#mapSchemaPath);
    if (parsed.kind === "malformed") return err({ kind: "corrupt", path, cause: parsed.error });
    return ok(parsed.map);
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(map: RefinementMap): Result<void, RepositoryError> {
    const path = map.id().artifactPath().asString();
    try {
      writeFileAtomically(path, map.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
