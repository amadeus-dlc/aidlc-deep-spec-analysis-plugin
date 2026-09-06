import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { LoweredBackground } from "./lowered-background.ts";

// lowered 背景のファーストクラスコレクション（BG-n 採番順を保持）。
export class LoweredBackgrounds extends FirstClassCollectionBase<LoweredBackground, LoweredBackgrounds> {
  readonly #values: readonly LoweredBackground[];

  private constructor(values: readonly LoweredBackground[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-lowered-backgrounds");
  }

  protected rebuild(values: readonly LoweredBackground[]): LoweredBackgrounds {
    return new LoweredBackgrounds(values);
  }

  static of(values: readonly LoweredBackground[]): LoweredBackgrounds {
    return new LoweredBackgrounds(values);
  }

  static parse(values: readonly LoweredBackground[]): Result<LoweredBackgrounds, ParseError> {
    return parseConstruction(() => new LoweredBackgrounds(values));
  }

  add(value: LoweredBackground): LoweredBackgrounds {
    return new LoweredBackgrounds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredBackground> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly LoweredBackground[] {
    return this.#values;
  }
}
