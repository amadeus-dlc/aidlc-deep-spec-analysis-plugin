import type { BackendName, TargetIdentifiers, UnitName } from "@deep-spec-analysis/kernel-domain";
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
type DesignCrossCheckedEntryParam = { backend: BackendName; unit: UnitName; targets: TargetIdentifiers };

export class DesignCrossCheckedEntry {
  readonly #backend: BackendName;
  readonly #unit: UnitName;
  readonly #targets: TargetIdentifiers;

  private constructor(props: DesignCrossCheckedEntryParam) {
    this.#backend = props.backend;
    this.#unit = props.unit;
    for (const target of props.targets)
      if (!target.asString().startsWith("DSC-"))
        throw new IllegalArgumentException({ kind: "invalid-cross-checked-target", raw: target.asString() });
    this.#targets = props.targets;
  }

  static of(props: DesignCrossCheckedEntryParam): DesignCrossCheckedEntry {
    return new DesignCrossCheckedEntry(props);
  }

  static parse(props: DesignCrossCheckedEntryParam): Result<DesignCrossCheckedEntry, ParseError> {
    return parseConstruction(() => new DesignCrossCheckedEntry(props));
  }

  unit(): UnitName {
    return this.#unit;
  }

  backend(): BackendName {
    return this.#backend;
  }

  targets(): TargetIdentifiers {
    return this.#targets;
  }

  compareTo(other: DesignCrossCheckedEntry): number {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    if (a !== b) return a < b ? -1 : 1;
    const unit = this.#unit.asString();
    const otherUnit = other.#unit.asString();
    return unit < otherUnit ? -1 : unit > otherUnit ? 1 : 0;
  }
}
