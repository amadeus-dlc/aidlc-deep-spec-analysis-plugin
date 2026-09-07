import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  type SkipReason,
  type TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { VerificationSkipped } from "./verification-skipped.ts";

function sortVerificationSkipped(skipped: readonly VerificationSkipped[]): VerificationSkipped[] {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

export class VerificationSkips
  extends FirstClassCollectionBase<VerificationSkipped, VerificationSkips>
  implements FirstClassCollection<VerificationSkipped>
{
  readonly #values: readonly VerificationSkipped[];

  private constructor(values: readonly VerificationSkipped[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-verification-skips");
  }

  protected override rebuild(values: readonly VerificationSkipped[]): VerificationSkips {
    return new VerificationSkips(values);
  }

  override map(transform: (element: VerificationSkipped) => VerificationSkipped): VerificationSkips {
    return this.mapTo(transform, VerificationSkips.of);
  }

  override combine(other: VerificationSkips): VerificationSkips {
    return this.combineTo(other, VerificationSkips.of);
  }

  static parse(values: readonly VerificationSkipped[]): Result<VerificationSkips, ParseError> {
    return parseConstruction(() => new VerificationSkips(values));
  }

  static of(values: readonly VerificationSkipped[]): VerificationSkips {
    return new VerificationSkips(values);
  }

  // 対象の順を保ったまま、全対象を同じ理由・同じ文言で skip する
  // （版不一致・ソルバ不能・機械不能の降格形が使う）。
  static coveringAll(targets: TargetIdentifiers, reason: SkipReason, detail: string): VerificationSkips {
    return new VerificationSkips([...targets].map((target) => VerificationSkipped.of({ target, reason, detail })));
  }

  add(value: VerificationSkipped): VerificationSkips {
    return new VerificationSkips([...this.#values, value]);
  }

  concat(other: VerificationSkips): VerificationSkips {
    return new VerificationSkips([...this.#values, ...other.#values]);
  }

  override *[Symbol.iterator](): Iterator<VerificationSkipped> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationSkips {
    return new VerificationSkips(sortVerificationSkipped(this.#values));
  }

  override count(): number {
    return this.#values.length;
  }

  // 境界: 描画専用。契約2 の skip キー順（target, reason, detail?）は旧構築
  // サイトの挿入順そのもの（golden バイト凍結）。
  toDocuments(): Json[] {
    return this.#values.map((skipped) => {
      const out: { [k: string]: Json } = { target: skipped.target().asString(), reason: skipped.reason() };
      const detail = skipped.detail();
      if (detail !== undefined) out.detail = detail;
      return out as Json;
    });
  }

  toArray(): readonly VerificationSkipped[] {
    return this.#values;
  }
}
