import type { InstallationProvenanceRead } from "./installation-provenance-read.ts";

// installer が成功後に残した来歴を読むポート。ファイル形式の解釈は adapter
// に留め、usecase には比較に必要な version/ref/source だけを渡す。
export interface InstallationProvenanceClient {
  read(): InstallationProvenanceRead;
}
