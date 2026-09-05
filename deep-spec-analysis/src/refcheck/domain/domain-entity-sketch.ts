import { type AttributeNames } from "./attribute-names.ts";
import { type EntityName } from "./entity-name.ts";
import type { ComponentName } from "./component-name.ts";

// domain-design 側エンティティの素描。functional-design 側との被覆差分と
// カタログ位置ラベル（凍結書式）を所有する。
export class DomainEntitySketch {
  readonly #name: EntityName;
  readonly #component: ComponentName;
  readonly #attributes: AttributeNames;

  private constructor(seed: Parameters<typeof DomainEntitySketch.of>[0]) {
    this.#name = seed.name;
    this.#component = seed.component;
    this.#attributes = seed.attributes;
  }

  static of(seed: {
    readonly name: EntityName;
    readonly component: ComponentName;
    readonly attributes: AttributeNames;
  }): DomainEntitySketch {
    return new DomainEntitySketch(seed);
  }

  name(): EntityName {
    return this.#name;
  }

  // 境界: witness に載るカタログ位置ラベル（凍結書式）。
  catalogLabel(): string {
    return `entity ${this.#name.asString()} (component ${this.#component.asString()})`;
  }

  // XS-3: このユニットの定義が落としている属性（値の昇順——凍結順）。
  attributesDroppedIn(unitAttrs: AttributeNames): string[] {
    return this.#attributes
      .toArray()
      .filter((a) => !unitAttrs.coversNormalized(a))
      .map((a) => a.asString())
      .sort();
  }
}
