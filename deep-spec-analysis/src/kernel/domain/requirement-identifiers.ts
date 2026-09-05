// RequirementIdentifiers — requirements.md が宣言する要件 id の集合（ファーストクラス
// コレクション）。要素は RequirementIdentifier、内側は KeySet（裁定 3-1、2026-09-03）。
// 抽出（`extractFrom`）は原文からの門、`has` は逆引き検証の問い。

import { KeySet } from "./key-set.ts";
import { RequirementIdentifier } from "./requirement-identifier.ts";

export class RequirementIdentifiers {
  readonly #values: KeySet<RequirementIdentifier>;

  private constructor(values: KeySet<RequirementIdentifier>) {
    this.#values = values;
  }

  static extractFrom(text: string): RequirementIdentifiers {
    const ids: RequirementIdentifier[] = [];
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.push(RequirementIdentifier.of(m[0]));
    }
    return new RequirementIdentifiers(KeySet.of(ids));
  }

  static of(values: readonly RequirementIdentifier[]): RequirementIdentifiers {
    return new RequirementIdentifiers(KeySet.of(values));
  }

  add(value: RequirementIdentifier): RequirementIdentifiers {
    return new RequirementIdentifiers(this.#values.with(value));
  }

  *[Symbol.iterator](): Iterator<RequirementIdentifier> {
    yield* this.#values;
  }

  has(value: RequirementIdentifier): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly RequirementIdentifier[] {
    return this.#values.toArray();
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.toArray().map((v) => v.asString());
  }
}
