// kernel/adapter の公開 facade — 明示列挙のみ（export * 禁止）。

export { parseFlags } from "./sensor-flags.ts";
export { renderVerdictLine } from "./verdict-line.ts";
export { findRecordRoot, relArtifact } from "./record-root.ts";
export { readIfExists } from "./read-if-exists.ts";
