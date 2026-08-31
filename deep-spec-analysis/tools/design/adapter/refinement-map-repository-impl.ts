// RefinementMapRepository の実 Gateway 実装。契約4 文書の解釈は composite
// 取得面（refinement-context-repository-impl）と共有パーサに一本化されており、
// corrupt.cause と absent(error) の凍結文言は常に一致する。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { RefinementMap, RefinementMapId } from "../../refinement/domain/index.ts";
import type { RefinementMapRepository } from "../usecase/index.ts";
import { parseRefinementMapDocument } from "./refinement-context-repository-impl.ts";

export class RefinementMapRepositoryImpl implements RefinementMapRepository {
  readonly #mapSchemaPath: string;

  constructor(mapSchemaPath: string) {
    this.#mapSchemaPath = mapSchemaPath;
  }

  findById(id: RefinementMapId): Result<RefinementMap, RepositoryError> {
    const path = id.artifactPath().asString();
    if (!existsSync(path)) return err({ kind: "not-found", path });
    let md: string;
    try {
      md = readFileSync(path, "utf-8");
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const parsed = parseRefinementMapDocument(md, id, this.#mapSchemaPath);
    if (parsed.kind === "malformed") return err({ kind: "corrupt", path, cause: parsed.error });
    return ok(parsed.map);
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(map: RefinementMap): Result<RefinementMap, RepositoryError> {
    const path = map.id().artifactPath().asString();
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, map.sourceDocument(), "utf-8");
      return ok(map);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
