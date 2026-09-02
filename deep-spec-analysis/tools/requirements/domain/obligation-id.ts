import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { TargetId } from "../../kernel/domain/index.ts";

type ObligationIdError = { readonly kind: "empty-obligation-id"; readonly raw: string };

export class ObligationId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ObligationId, ObligationIdError> {
    if (raw === "") return err({ kind: "empty-obligation-id", raw });
    return ok(new ObligationId(raw));
  }

  static reconstitute(raw: string): ObligationId {
    return new ObligationId(raw);
  }

  equals(other: ObligationId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: ObligationId): number {
    return this.asTargetId().compareTo(other.asTargetId());
  }

  asString(): string {
    return this.#value;
  }

  // 義務 id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetId {
    return TargetId.reconstitute(this.#value);
  }
}
