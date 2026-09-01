import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

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
  entityToken(): string { return this.#value.split(".")[0] ?? ""; }
  attributeToken(): string | undefined { return this.#value.split(".")[1]; }
}
