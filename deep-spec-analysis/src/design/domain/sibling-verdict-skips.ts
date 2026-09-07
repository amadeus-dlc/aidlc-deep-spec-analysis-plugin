import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { SiblingVerdictSkip } from "./sibling-verdict-skip.ts";

// 兄弟バックエンド判定 skip のファーストクラスコレクション（文書順を保持）。
export class SiblingVerdictSkips extends FirstClassCollectionBase<SiblingVerdictSkip, SiblingVerdictSkips> {
  readonly #values: readonly SiblingVerdictSkip[];

  private constructor(values: readonly SiblingVerdictSkip[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-sibling-verdict-skips");
  }

  protected override rebuild(values: readonly SiblingVerdictSkip[]): SiblingVerdictSkips {
    return new SiblingVerdictSkips(values);
  }

  static of(values: readonly SiblingVerdictSkip[]): SiblingVerdictSkips {
    return new SiblingVerdictSkips(values);
  }

  static parse(values: readonly SiblingVerdictSkip[]): Result<SiblingVerdictSkips, ParseError> {
    return parseConstruction(() => new SiblingVerdictSkips(values));
  }

  add(value: SiblingVerdictSkip): SiblingVerdictSkips {
    return new SiblingVerdictSkips([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<SiblingVerdictSkip> {
    yield* this.#values;
  }

  toArray(): readonly SiblingVerdictSkip[] {
    return this.#values;
  }
}
