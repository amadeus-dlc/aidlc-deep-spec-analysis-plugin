// RequirementIds — requirements.md が宣言する要件 id の集合（ファーストクラス
// コレクション）。要素は RequirementId、内側は KeySet（裁定 3-1、2026-09-03）。
// 抽出（`extractFrom`）は原文からの門、`has` は逆引き検証の問い。

import { KeySet } from "./key-set.ts";
import { RequirementId } from "./requirement-id.ts";

export class RequirementIds {
  readonly #values: KeySet<RequirementId>;

  private constructor(values: KeySet<RequirementId>) {
    this.#values = values;
  }

  static extractFrom(text: string): RequirementIds {
    const ids: RequirementId[] = [];
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.push(RequirementId.reconstitute(m[0]));
    }
    return new RequirementIds(KeySet.of(ids));
  }

  static of(values: readonly RequirementId[]): RequirementIds {
    return new RequirementIds(KeySet.of(values));
  }

  static reconstitute(raws: readonly string[]): RequirementIds {
    return new RequirementIds(KeySet.of(raws.map((raw) => RequirementId.reconstitute(raw))));
  }

  add(value: RequirementId): RequirementIds {
    return new RequirementIds(this.#values.with(value));
  }

  *[Symbol.iterator](): Iterator<RequirementId> {
    yield* this.#values;
  }

  has(value: RequirementId): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly RequirementId[] {
    return this.#values.toArray();
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.toArray().map((v) => v.asString());
  }
}
