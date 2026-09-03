import { TargetId } from "@deep-spec/kernel-domain";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type DesignTransitionIdError = { readonly kind: "empty-design-transition-id"; readonly raw: string };

export class DesignTransitionId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignTransitionId, DesignTransitionIdError> {
    if (raw === "") return err({ kind: "empty-design-transition-id", raw });
    return ok(new DesignTransitionId(raw));
  }

  static reconstitute(raw: string): DesignTransitionId {
    return new DesignTransitionId(raw);
  }

  equals(other: DesignTransitionId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignTransitionId): number {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }

  asString(): string {
    return this.#value;
  }
}
