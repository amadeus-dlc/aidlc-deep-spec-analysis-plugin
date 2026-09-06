import type { BackendName, TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

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
    for (const target of props.targets)
      if (!target.asString().startsWith("SC-"))
        throw new IllegalArgumentException({ kind: "invalid-cross-checked-target", raw: target.asString() });
    this.#targets = props.targets;
  }

  static of(props: CrossCheckedEntryParam): CrossCheckedEntry {
    return new CrossCheckedEntry(props);
  }

  static parse(props: CrossCheckedEntryParam): Result<CrossCheckedEntry, ParseError> {
    return parseConstruction(() => new CrossCheckedEntry(props));
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
