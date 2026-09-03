import { EntityName } from "./entity-name.ts";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

// `### State Machine: <spec>` 見出しの対象（"Entity" または "Entity.attribute"）。
export class MachineSpec {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<MachineSpec, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new MachineSpec(raw));
  }
  static reconstitute(raw: string): MachineSpec { return new MachineSpec(raw); }
  equals(other: MachineSpec): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // "Entity.attribute" の分解は spec 語彙そのもの（旧 split(".") の凍結挙動）。
  // `Entity.attribute` の実体側——名前 DP として返す（裁定 3）。
  entityToken(): EntityName { return EntityName.reconstitute(this.#value.split(".")[0] ?? ""); }
  attributeToken(): string | undefined { return this.#value.split(".")[1]; }
}
