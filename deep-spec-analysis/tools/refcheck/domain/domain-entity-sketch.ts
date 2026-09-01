import type { DomainEntitySketchSeed } from "./domain-entity-sketch-seed.ts";
import { type AttributeNames } from "./attribute-names.ts";
import { type EntityName } from "./entity-name.ts";

// domain-design 側エンティティの素描。functional-design 側との被覆差分と
// カタログ位置ラベル（凍結書式）を所有する。
export class DomainEntitySketch {
  readonly #seed: DomainEntitySketchSeed;

  private constructor(seed: DomainEntitySketchSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: DomainEntitySketchSeed): DomainEntitySketch {
    return new DomainEntitySketch(seed);
  }

  name(): EntityName {
    return this.#seed.name;
  }

  // 境界: witness に載るカタログ位置ラベル（凍結書式）。
  catalogLabel(): string {
    return `entity ${this.#seed.name.asString()} (component ${this.#seed.component.asString()})`;
  }

  // XS-3: このユニットの定義が落としている属性（値の昇順——凍結順）。
  attributesDroppedIn(unitAttrs: AttributeNames): string[] {
    return this.#seed.attributes
      .toArray()
      .filter((a) => !unitAttrs.coversNormalized(a))
      .map((a) => a.asString())
      .sort();
  }
}
