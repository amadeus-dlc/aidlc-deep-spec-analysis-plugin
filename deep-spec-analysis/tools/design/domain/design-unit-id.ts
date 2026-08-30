// DesignUnitId — DesignModel 集約内のエンティティ DesignUnit の識別子。
// 恒等はユニット名（construction ディレクトリ名）。名前の正当性検証
// （スキーマの ^[a-z0-9][a-z0-9-]{0,63}$）は凍結封鎖中の UnitName DP の
// 責務であり、この ID は恒等だけを運ぶ。

export class DesignUnitId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(value: string): DesignUnitId {
    return new DesignUnitId(value);
  }

  equals(other: DesignUnitId): boolean {
    return this.#value === other.#value;
  }

  // 境界: 文書・文言・写像キーに逐語で載るユニット名。
  value(): string {
    return this.#value;
  }
}
