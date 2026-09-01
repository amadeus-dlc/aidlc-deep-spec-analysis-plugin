import { DomainEntitySketch } from "./domain-entity-sketch.ts";

// domain-design 側素描のコレクション。名前順の整列と正規化名での一意化
// （XS 検査の凍結挙動）を所有する。
export class DomainEntitySketches {
  readonly #values: readonly DomainEntitySketch[];

  private constructor(values: readonly DomainEntitySketch[]) {
    this.#values = values;
  }

  static of(values: readonly DomainEntitySketch[]): DomainEntitySketches {
    return new DomainEntitySketches([...values]);
  }

  add(value: DomainEntitySketch): DomainEntitySketches {
    return new DomainEntitySketches([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DomainEntitySketch> {
    yield* this.#values;
  }

  // 名前昇順に整列し、正規化名の初出だけを残す（XS の巡回順——凍結）。
  sortedDistinctByNormalizedName(): DomainEntitySketch[] {
    const sorted = [...this.#values].sort((a, b) => (a.name().asString() < b.name().asString() ? -1 : 1));
    const seen = new Set<string>();
    const out: DomainEntitySketch[] = [];
    for (const de of sorted) {
      const key = de.name().normalized();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(de);
    }
    return out;
  }

  toArray(): readonly DomainEntitySketch[] {
    return this.#values;
  }
}
