import type { ParseError } from "@deep-spec/kernel-infrastructure";
import {
  compareCanonically,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

export class DesignScenarioIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "design-scenario-id-too-long", raw: raw.length });
    if (!/^DSC-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-design-scenario-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignScenarioIdentifier {
    return new DesignScenarioIdentifier(raw);
  }

  static parse(raw: string): Result<DesignScenarioIdentifier, ParseError> {
    return parseConstruction(() => new DesignScenarioIdentifier(raw));
  }

  equals(other: DesignScenarioIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetIdentifier が所有する順序に従う（裁定 1）。
  compareTo(other: DesignScenarioIdentifier): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
