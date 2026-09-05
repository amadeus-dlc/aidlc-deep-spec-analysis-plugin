// contract-summary.md と units エッジブロックの型付き入力モデル（domain 語彙）。
// 解析（markdown テーブル/fence/YAML 歩き）はアダプタのパーサが行う。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクション。

import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { ContractRow } from "./contract-row.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { UnitDeclarations } from "./unit-declarations.ts";

export class ContractRows {
  readonly #values: readonly ContractRow[];

  private constructor(values: readonly ContractRow[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly ContractRow[]): ContractRows {
    return new ContractRows(values);
  }

  add(value: ContractRow): ContractRows {
    return new ContractRows([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ContractRow> {
    yield* this.#values;
  }

  // CD-3：行が両方向で覆う (provider, consumer) 対の集合知識。
  coversEdge(from: string, to: string): boolean {
    return this.#values.some((r) => r.connects(from, to));
  }

  toArray(): readonly ContractRow[] {
    return this.#values;
  }

  // CD-1: 各行の当事者が宣言済みユニットかを、行ごとに判定させる（発生順は
  // 表の行順、凍結）。
  checkPartiesDeclared(
    declared: UnitDeclarations,
    report: ReferenceCheckReport,
    artifact: ArtifactPath,
    depArtifact: ArtifactPath,
  ): void {
    for (const row of this) {
      row.checkPartiesDeclared(declared, report, artifact, depArtifact);
    }
  }
}
