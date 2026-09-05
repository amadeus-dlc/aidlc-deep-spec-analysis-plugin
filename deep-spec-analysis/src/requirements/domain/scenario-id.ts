import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { TargetId } from "@deep-spec/kernel-domain";

export class ScenarioId {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "scenario-id-too-long", raw: raw.length });
    if (!/^SC-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-scenario-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ScenarioId {
    return new ScenarioId(raw);
  }

  static parse(raw: string): Result<ScenarioId, ParseError> {
    return parseConstruction(() => new ScenarioId(raw));
  }

  equals(other: ScenarioId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  // シナリオ id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetId {
    return TargetId.of(this.#value);
  }
}
