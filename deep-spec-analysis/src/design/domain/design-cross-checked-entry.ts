import type { BackendName, TargetIds } from "@deep-spec/kernel-domain";

// クロスチェックに参加したバックエンドと、比較したシナリオの対象 id 列
// （契約2 crossChecked[]）。バックエンド名順（凍結順）は項目自身の知識
// （#71 波19）。
export class DesignCrossCheckedEntry {
  readonly #backend: BackendName;
  readonly #targets: TargetIds;

  private constructor(props: { backend: BackendName; targets: TargetIds }) {
    this.#backend = props.backend;
    this.#targets = props.targets;
  }

  static reconstitute(props: { backend: BackendName; targets: TargetIds }): DesignCrossCheckedEntry {
    return new DesignCrossCheckedEntry(props);
  }

  backend(): BackendName {
    return this.#backend;
  }

  targets(): TargetIds {
    return this.#targets;
  }

  compareByBackend(other: DesignCrossCheckedEntry): number {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
