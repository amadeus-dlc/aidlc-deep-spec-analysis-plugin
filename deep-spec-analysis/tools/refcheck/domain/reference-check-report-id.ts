// ReferenceCheckReport 集約の識別子 — 配置ディレクトリ＋backend 名。
// Repository はこの識別子だけから保存先／読出元を導出する。

export class ReferenceCheckReportId {
  readonly #directory: string;
  readonly #backend: string;

  private constructor(directory: string, backend: string) {
    this.#directory = directory;
    this.#backend = backend;
  }

  static of(directory: string, backend: string): ReferenceCheckReportId {
    return new ReferenceCheckReportId(directory, backend);
  }

  equals(other: ReferenceCheckReportId): boolean {
    return this.#directory === other.#directory && this.#backend === other.#backend;
  }

  // 境界: 契約2 文書の backend フィールドに逐語で載る値。
  backendName(): string {
    return this.#backend;
  }

  // 境界: Repository が保存先ディレクトリを導出するための識別子の片割れ。
  directory(): string {
    return this.#directory;
  }

  // 境界: Repository が保存先ファイル名を導出するための識別子の片割れ。
  fileName(): string {
    return `${this.#backend}.json`;
  }
}
