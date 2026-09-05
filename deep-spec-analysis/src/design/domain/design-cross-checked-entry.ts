import type { BackendName, TargetIdentifiers } from "@deep-spec/kernel-domain";

// クロスチェックに参加したバックエンドと、比較したシナリオの対象 id 列
// （契約2 crossChecked[]）。バックエンド名順（凍結順）は項目自身の知識
// （#71 波19）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignCrossCheckedEntryParam = { backend: BackendName; targets: TargetIdentifiers };

export class DesignCrossCheckedEntry {
  readonly #backend: BackendName;
  readonly #targets: TargetIdentifiers;

  private constructor(props: DesignCrossCheckedEntryParam) {
    this.#backend = props.backend;
    this.#targets = props.targets;
  }

  static of(props: DesignCrossCheckedEntryParam): DesignCrossCheckedEntry {
    return new DesignCrossCheckedEntry(props);
  }

  backend(): BackendName {
    return this.#backend;
  }

  targets(): TargetIdentifiers {
    return this.#targets;
  }

  compareByBackend(other: DesignCrossCheckedEntry): number {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
