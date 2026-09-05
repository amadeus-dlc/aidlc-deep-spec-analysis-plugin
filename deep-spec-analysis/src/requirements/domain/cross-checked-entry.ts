import type { BackendName, TargetIdentifiers } from "@deep-spec/kernel-domain";

// クロスチェックに参加したバックエンドと、比較したシナリオの対象 id 列
// （契約2 crossChecked[]）。バックエンド名順（凍結順）は項目自身の知識
// （#71 波19）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type CrossCheckedEntryParam = { backend: BackendName; targets: TargetIdentifiers };

export class CrossCheckedEntry {
  readonly #backend: BackendName;
  readonly #targets: TargetIdentifiers;

  private constructor(props: CrossCheckedEntryParam) {
    this.#backend = props.backend;
    this.#targets = props.targets;
  }

  static of(props: CrossCheckedEntryParam): CrossCheckedEntry {
    return new CrossCheckedEntry(props);
  }

  backend(): BackendName {
    return this.#backend;
  }

  targets(): TargetIdentifiers {
    return this.#targets;
  }

  compareByBackend(other: CrossCheckedEntry): number {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
