import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import {
  hashOfString,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { AttributeName } from "./attribute-name.ts";
import { EntityName } from "./entity-name.ts";

// `### State Machine: <spec>` 見出しの対象（"Entity" または "Entity.attribute"）。
export class MachineSpecification {
  readonly #value: string;
  readonly #entity: EntityName;
  readonly #attribute: AttributeName | null;
  /** 全体の読取予算は4,096 UTF-16コード単位。構成要素は各名前の契約に従う。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "machine-spec-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    if (!raw.isWellFormed() || /\p{Cc}/u.test(raw))
      throw new IllegalArgumentException({ kind: "invalid-machine-spec-characters" });
    const parts = raw.split(".");
    if (parts.length > 2 || parts.some((part) => part.length === 0 || part.trim() !== part))
      throw new IllegalArgumentException({ kind: "invalid-machine-spec-syntax" });
    this.#entity = EntityName.of(parts[0]);
    this.#attribute = parts[1] === undefined ? null : AttributeName.of(parts[1]);
    this.#value = raw;
  }
  static of(raw: string): MachineSpecification {
    return new MachineSpecification(raw);
  }

  static parse(raw: string): Result<MachineSpecification, ParseError> {
    return parseConstruction(() => new MachineSpecification(raw));
  }
  equals(other: MachineSpecification): boolean {
    return this.#value === other.#value;
  }
  hashCode(): number {
    return hashOfString(this.#value);
  }
  asString(): string {
    return this.#value;
  }
  entityToken(): EntityName {
    return this.#entity;
  }
  attributeToken(): AttributeName | null {
    return this.#attribute;
  }
}
