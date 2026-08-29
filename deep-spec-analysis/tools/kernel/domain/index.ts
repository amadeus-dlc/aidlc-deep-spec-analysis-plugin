// kernel/domain の公開 facade — この層の公開 API を明示列挙する（export * 禁止）。
// ディレクトリ外からの import は必ずこのファイルを経由すること。

export { type Result, type Ok, type Err, ok, err, unreachable } from "./result.ts";
export { type Json, isObject } from "./json-value.ts";
export { canonicalStringify } from "./canonical-json.ts";
export { sha256 } from "./content-hash.ts";
export { idCompare, sortedUnique } from "./id-order.ts";
export { type Fence, extractFences } from "./markdown-fences.ts";
export { type Yaml, parseYamlSubset } from "./yaml-subset.ts";
export { type MdTable, parseMarkdownTables } from "./markdown-tables.ts";
export { type Schema, validateSchema } from "./schema-validator.ts";
export { safeTarget } from "./target-id.ts";
export { requirementIds } from "./requirement-ids.ts";
export { normalizeName } from "./name-normalize.ts";
