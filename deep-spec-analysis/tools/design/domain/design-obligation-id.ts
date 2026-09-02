import { TargetId } from "../../kernel/domain/index.ts";
import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type DesignObligationIdError = { readonly kind: "empty-design-obligation-id"; readonly raw: string };

export class DesignObligationId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignObligationId, DesignObligationIdError> {
    if (raw === "") return err({ kind: "empty-design-obligation-id", raw });
    return ok(new DesignObligationId(raw));
  }

  static reconstitute(raw: string): DesignObligationId {
    return new DesignObligationId(raw);
  }

  equals(other: DesignObligationId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignObligationId): number {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }

  asString(): string {
    return this.#value;
  }
}
