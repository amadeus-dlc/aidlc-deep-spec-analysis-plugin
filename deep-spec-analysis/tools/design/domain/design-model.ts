// DesignModel 集約 — 検証済み設計の形式モデル（契約3）のドメイン表現。
// ユニットのユニット名昇順は集約の不変条件として compose が一度だけ適用する
// （旧 parseDesignIr 末尾のソートの移設）。

import type { DesignUnit } from "./design-unit.ts";

export interface DesignModelComposition {
  readonly irVersion: string;
  readonly units: readonly DesignUnit[];
}

export class DesignModel {
  readonly #irVersion: string;
  readonly #units: readonly DesignUnit[];

  private constructor(irVersion: string, units: readonly DesignUnit[]) {
    this.#irVersion = irVersion;
    this.#units = units;
  }

  // ユニット名昇順を不変条件としてここで一度だけ適用する。
  static compose(input: DesignModelComposition): DesignModel {
    return new DesignModel(
      input.irVersion,
      [...input.units].sort((a, b) => (a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0)),
    );
  }

  irVersion(): string {
    return this.#irVersion;
  }

  // 境界: 旧実装の major 抽出と同じ計算（skip detail 文言に載る）。
  majorVersion(): number {
    return Number.parseInt(this.#irVersion.split(".")[0] ?? "", 10);
  }

  supportsMajor(major: number): boolean {
    return this.majorVersion() === major;
  }

  units(): readonly DesignUnit[] {
    return this.#units;
  }
}
