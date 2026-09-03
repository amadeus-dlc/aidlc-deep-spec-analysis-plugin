import { TargetId } from "@deep-spec/kernel-domain";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type DesignBackgroundIdError = { readonly kind: "empty-design-background-id"; readonly raw: string };

export class DesignBackgroundId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignBackgroundId, DesignBackgroundIdError> {
    if (raw === "") return err({ kind: "empty-design-background-id", raw });
    return ok(new DesignBackgroundId(raw));
  }

  static reconstitute(raw: string): DesignBackgroundId {
    return new DesignBackgroundId(raw);
  }

  equals(other: DesignBackgroundId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignBackgroundId): number {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }

  asString(): string {
    return this.#value;
  }
}
