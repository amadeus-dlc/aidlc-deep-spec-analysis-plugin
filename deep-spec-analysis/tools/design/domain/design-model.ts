// DesignModel 集約 — 検証済み設計の形式モデル（契約3）のドメイン表現。
// ユニットのユニット名昇順は集約の不変条件として compose が一度だけ適用する
// （旧 parseDesignIr 末尾のソートの移設）。

import type { DesignModelId } from "./design-model-id.ts";
import type { IrVersion } from "../../kernel/domain/index.ts";
import { DesignUnits } from "./design-unit.ts";

export interface DesignModelComposition {
  readonly id: DesignModelId;
  readonly irVersion: IrVersion;
  readonly units: DesignUnits;
}

export class DesignModel {
  readonly #id: DesignModelId;
  readonly #irVersion: IrVersion;
  readonly #units: DesignUnits;

  private constructor(id: DesignModelId, irVersion: IrVersion, units: DesignUnits) {
    this.#id = id;
    this.#irVersion = irVersion;
    this.#units = units;
  }

  // ユニット名昇順を不変条件としてここで一度だけ適用する。
  static compose(input: DesignModelComposition): DesignModel {
    return new DesignModel(input.id, input.irVersion, input.units.sortedByName());
  }

  id(): DesignModelId {
    return this.#id;
  }

  irVersion(): IrVersion {
    return this.#irVersion;
  }

  // 境界: 旧実装の major 抽出と同じ計算（skip detail 文言に載る）。
  majorVersion(): number {
    return this.#irVersion.majorVersion();
  }

  supportsMajor(major: number): boolean {
    return this.#irVersion.supportsMajor(major);
  }

  units(): DesignUnits {
    return this.#units;
  }
}
