import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { SiblingVerdictFinding } from "./sibling-verdict-finding.ts";

// 兄弟バックエンド判定 finding のファーストクラスコレクション（文書順を保持）。
export class SiblingVerdictFindings extends FirstClassCollectionBase<SiblingVerdictFinding, SiblingVerdictFindings> {
  readonly #values: readonly SiblingVerdictFinding[];

  private constructor(values: readonly SiblingVerdictFinding[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-sibling-verdict-findings");
  }

  protected override rebuild(values: readonly SiblingVerdictFinding[]): SiblingVerdictFindings {
    return new SiblingVerdictFindings(values);
  }

  static of(values: readonly SiblingVerdictFinding[]): SiblingVerdictFindings {
    return new SiblingVerdictFindings(values);
  }

  override map(transform: (element: SiblingVerdictFinding) => SiblingVerdictFinding): SiblingVerdictFindings {
    return this.mapTo(transform, SiblingVerdictFindings.of);
  }

  override combine(other: SiblingVerdictFindings): SiblingVerdictFindings {
    return this.combineTo(other, SiblingVerdictFindings.of);
  }

  static parse(values: readonly SiblingVerdictFinding[]): Result<SiblingVerdictFindings, ParseError> {
    return parseConstruction(() => new SiblingVerdictFindings(values));
  }

  add(value: SiblingVerdictFinding): SiblingVerdictFindings {
    return new SiblingVerdictFindings([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<SiblingVerdictFinding> {
    yield* this.#values;
  }

  toArray(): readonly SiblingVerdictFinding[] {
    return this.#values;
  }
}
