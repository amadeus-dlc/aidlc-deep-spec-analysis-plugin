import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type RefinementMapTokenError = { readonly kind: "empty-refinement-map-token"; readonly raw: string };

// eventMap.transitions の要素——写像先の設計 遷移/義務 id への宣言参照。
export class TransitionRef {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<TransitionRef, RefinementMapTokenError> {
    if (raw === "") return err({ kind: "empty-refinement-map-token", raw });
    return ok(new TransitionRef(raw));
  }

  static reconstitute(raw: string): TransitionRef {
    return new TransitionRef(raw);
  }

  equals(other: TransitionRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
