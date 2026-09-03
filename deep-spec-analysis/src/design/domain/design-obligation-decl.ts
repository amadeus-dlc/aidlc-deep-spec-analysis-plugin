import type { Expression } from "@deep-spec/kernel-domain";
import { BrRefs } from "./br-refs.ts";
import { type DesignObligationId } from "./design-obligation-id.ts";
import { type DesignObligationOrigin } from "./design-obligation-origin.ts";

export class DesignObligationDecl {
  readonly #id: DesignObligationId;
  readonly #origin: DesignObligationOrigin | undefined;
  readonly #brRefs: BrRefs | undefined;
  readonly #assert: Expression | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: { readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression } | undefined;

  private constructor(props: {
    id: DesignObligationId;
    origin?: DesignObligationOrigin;
    brRefs?: BrRefs;
    assert?: Expression;
    guard?: Expression;
    effect?: Expression;
    temporal?: { readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
  }) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#brRefs = props.brRefs;
    this.#assert = props.assert;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal === undefined ? undefined : { ...props.temporal };
  }

  static reconstitute(props: {
    id: DesignObligationId;
    origin?: DesignObligationOrigin;
    brRefs?: BrRefs;
    assert?: Expression;
    guard?: Expression;
    effect?: Expression;
    temporal?: { readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
  }): DesignObligationDecl {
    return new DesignObligationDecl(props);
  }

  id(): DesignObligationId { return this.#id; }
  brRefs(): BrRefs | undefined { return this.#brRefs; }

  missesRequiredBrRefs(): boolean {
    return this.#origin?.isRules() === true && this.#brRefs === undefined;
  }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined) visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined) visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined) visitor(this.#temporal.to, false);
  }
}
