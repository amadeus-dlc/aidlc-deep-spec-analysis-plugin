// DesignReport 集約の識別子 — 配置ディレクトリ（deep-spec-design-verify/）＋
// backend 名（smt / quint / cross-check）。Repository はここから保存先／
// 読出元を導出する。requirements の VerificationReportId と同形だが、境界
// づけられたコンテキストは自分の識別語彙を所有する（横断 import はしない）。

import type { ArtifactPath } from "../../kernel/domain/index.ts";

export class DesignReportId {
  readonly #directory: ArtifactPath;
  readonly #backend: string;

  private constructor(directory: ArtifactPath, backend: string) {
    this.#directory = directory;
    this.#backend = backend;
  }

  static of(directory: ArtifactPath, backend: string): DesignReportId {
    return new DesignReportId(directory, backend);
  }

  equals(other: DesignReportId): boolean {
    return this.#directory.equals(other.#directory) && this.#backend === other.#backend;
  }

  // 境界: 契約2 文書の backend フィールドに逐語で載る値。
  backendName(): string {
    return this.#backend;
  }

  // 境界: Repository が保存先ディレクトリを導出するための識別子の片割れ。
  directory(): ArtifactPath {
    return this.#directory;
  }

  // 境界: Repository が保存先ファイル名を導出するための識別子の片割れ。
  fileName(): string {
    return `${this.#backend}.json`;
  }
}
