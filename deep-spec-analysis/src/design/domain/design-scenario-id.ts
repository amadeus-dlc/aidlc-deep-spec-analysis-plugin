import { TargetId } from "@deep-spec/kernel-domain";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type DesignScenarioIdError = { readonly kind: "empty-design-scenario-id"; readonly raw: string };

export class DesignScenarioId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignScenarioId, DesignScenarioIdError> {
    if (raw === "") return err({ kind: "empty-design-scenario-id", raw });
    return ok(new DesignScenarioId(raw));
  }

  static reconstitute(raw: string): DesignScenarioId {
    return new DesignScenarioId(raw);
  }

  equals(other: DesignScenarioId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignScenarioId): number {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }

  asString(): string {
    return this.#value;
  }
}
