// VerificationReport 集約の識別子 — 配置ディレクトリ（deep-spec-verify/）＋
// backend 名（smt / quint / cross-check）。Repository はここから保存先／
// 読出元を導出する。

import { BackendName } from "@deep-spec/kernel-domain";
import type { ArtifactPath } from "@deep-spec/kernel-domain";

export class VerificationReportId {
  readonly #directory: ArtifactPath;
  readonly #backend: BackendName;

  private constructor(directory: ArtifactPath, backend: BackendName) {
    this.#directory = directory;
    this.#backend = backend;
  }

  // of は識別組立ての門——backend 名は生語彙(ファイル名・CLI)から包む。
  static of(directory: ArtifactPath, backend: string): VerificationReportId {
    return new VerificationReportId(directory, BackendName.of(backend));
  }

  equals(other: VerificationReportId): boolean {
    return this.#directory.equals(other.#directory) && this.#backend.equals(other.#backend);
  }

  backendName(): BackendName {
    return this.#backend;
  }

  // 境界: Repository が保存先ディレクトリを導出するための識別子の片割れ。
  directory(): ArtifactPath {
    return this.#directory;
  }

  // 境界: Repository が保存先ファイル名を導出するための識別子の片割れ。
  fileName(): string {
    return `${this.#backend.asString()}.json`;
  }
}
