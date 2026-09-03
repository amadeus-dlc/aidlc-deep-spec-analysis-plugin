import { TargetId } from "@deep-spec/kernel-domain";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class ComponentName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ComponentName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ComponentName(raw));
  }
  static reconstitute(raw: string): ComponentName { return new ComponentName(raw); }
  equals(other: ComponentName): boolean { return this.#value === other.#value; }
  // 正準順（裁定 1）——kernel の TargetId が所有する順序に従う。
  compareTo(other: ComponentName): number { return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value)); }
  asString(): string { return this.#value; }
}
