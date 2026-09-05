import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { TargetIdentifier } from "@deep-spec/kernel-domain";

export class ScenarioIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "scenario-id-too-long", raw: raw.length });
    if (!/^SC-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-scenario-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ScenarioIdentifier {
    return new ScenarioIdentifier(raw);
  }

  static parse(raw: string): Result<ScenarioIdentifier, ParseError> {
    return parseConstruction(() => new ScenarioIdentifier(raw));
  }

  equals(other: ScenarioIdentifier): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  // シナリオ id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetIdentifier {
    return TargetIdentifier.of(this.#value);
  }
}
