import {
  FirstClassCollectionBase,
  type NonEmptyFirstClassCollection,
  type SkipReason,
  type TargetIdentifier,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignSkipped } from "./design-skipped.ts";

function sortDesignSkipped(skipped: readonly DesignSkipped[]): DesignSkipped[] {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

export class DesignSkips extends FirstClassCollectionBase<DesignSkipped, DesignSkips> {
  readonly #values: readonly DesignSkipped[];

  private constructor(values: readonly DesignSkipped[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-skips");
  }

  protected override rebuild(values: readonly DesignSkipped[]): DesignSkips {
    return new DesignSkips(values);
  }

  static of(values: readonly DesignSkipped[]): DesignSkips {
    return new DesignSkips(values);
  }

  override map(transform: (element: DesignSkipped) => DesignSkipped): DesignSkips {
    return this.mapTo(transform, DesignSkips.of);
  }

  override combine(other: DesignSkips): DesignSkips {
    return this.combineTo(other, DesignSkips.of);
  }

  static parse(values: readonly DesignSkipped[]): Result<DesignSkips, ParseError> {
    return parseConstruction(() => new DesignSkips(values));
  }

  // 一つのユニットの対象列を、同じ理由・同じ説明でまるごと skip した列。
  // 対象の順序は渡された列のまま（正準ソートは compose が後段で適用する）。
  static forTargets(
    targets: NonEmptyFirstClassCollection<TargetIdentifier>,
    unit: UnitName,
    reason: SkipReason,
    detail: string | undefined,
  ): DesignSkips {
    return DesignSkips.of([...targets].map((target) => DesignSkipped.of({ target, reason, detail, unit })));
  }

  add(value: DesignSkipped): DesignSkips {
    return new DesignSkips([...this.#values, value]);
  }

  concat(other: DesignSkips): DesignSkips {
    return new DesignSkips([...this.#values, ...other.#values]);
  }

  override *[Symbol.iterator](): Iterator<DesignSkipped> {
    yield* this.#values;
  }

  sortedCanonically(): DesignSkips {
    return new DesignSkips(sortDesignSkipped(this.#values));
  }

  override count(): number {
    return this.#values.length;
  }

  // 境界: 描画専用。契約2 の skip キー順（target, reason, unit, detail?）は
  // 旧構築サイトの挿入順そのもの（golden バイト凍結）。
  toDocuments(): Json[] {
    return this.#values.map((skipped) => {
      const out: { [k: string]: Json } = {
        target: skipped.target().asString(),
        reason: skipped.reason(),
        unit: skipped.unit(),
      };
      const detail = skipped.detail();
      if (detail !== undefined) out.detail = detail;
      return out as Json;
    });
  }

  toArray(): readonly DesignSkipped[] {
    return this.#values;
  }
}
