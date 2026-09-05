import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { EntityName } from "./entity-name.ts";

// `### State Machine: <spec>` 見出しの対象（"Entity" または "Entity.attribute"）。
export class MachineSpec {
  readonly #value: string;
  /** 状態機械の指定文の処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "machine-spec-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): MachineSpec {
    return new MachineSpec(raw);
  }

  static parse(raw: string): Result<MachineSpec, ParseError> {
    return parseConstruction(() => new MachineSpec(raw));
  }
  equals(other: MachineSpec): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // "Entity.attribute" の分解は spec 語彙そのもの（旧 split(".") の凍結挙動）。
  // `Entity.attribute` の実体側——名前 DP として返す（裁定 3）。
  entityToken(): EntityName { return EntityName.of(this.#value.split(".")[0] ?? ""); }
  attributeToken(): string | undefined { return this.#value.split(".")[1]; }
}
