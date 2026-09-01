import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type RefinementMapTokenError = { readonly kind: "empty-refinement-map-token"; readonly raw: string };

// unmapped[].target の宣言トークン——要件属性パス・義務 id・シナリオ id の
// どれをも指しうる契約4 の waiver 語彙。
export class UnmappedTargetRef {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<UnmappedTargetRef, RefinementMapTokenError> {
    if (raw === "") return err({ kind: "empty-refinement-map-token", raw });
    return ok(new UnmappedTargetRef(raw));
  }

  static reconstitute(raw: string): UnmappedTargetRef {
    return new UnmappedTargetRef(raw);
  }

  equals(other: UnmappedTargetRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
