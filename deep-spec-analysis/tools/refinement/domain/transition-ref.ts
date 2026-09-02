import { TargetId } from "../../kernel/domain/index.ts";
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

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: TransitionRef): number {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }

  asString(): string {
    return this.#value;
  }
}
