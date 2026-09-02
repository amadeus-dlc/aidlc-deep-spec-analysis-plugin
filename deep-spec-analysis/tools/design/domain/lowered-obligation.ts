import type { Expression } from "../../kernel/domain/index.ts";
import type { LoweredId } from "./lowered-id.ts";

// lowered v1 義務（兄弟バックエンドへ渡す契約1 の形）。id は lowered 語彙
// （OB-n）、nature は分類文字列、trigger は lowered 文書の生トリガ名。ペイロード
// の面（どの任意部が存在するか）は義務自身の知識（#71 波20）。temporal は
// 契約1 の時相宣言そのまま（pattern と assert / from / to）。
export class LoweredObligation {
  readonly #id: LoweredId;
  readonly #nature: string;
  readonly #frRefs: readonly string[];
  readonly #assert: Expression | undefined;
  readonly #trigger: string | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression } | undefined;

  private constructor(props: {
    id: LoweredId;
    nature: string;
    frRefs: readonly string[];
    assert?: Expression;
    trigger?: string;
    guard?: Expression;
    effect?: Expression;
    temporal?: { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
  }) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#frRefs = [...props.frRefs];
    this.#assert = props.assert;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal;
  }

  static reconstitute(props: {
    id: LoweredId;
    nature: string;
    frRefs: readonly string[];
    assert?: Expression;
    trigger?: string;
    guard?: Expression;
    effect?: Expression;
    temporal?: { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
  }): LoweredObligation {
    return new LoweredObligation(props);
  }

  id(): LoweredId {
    return this.#id;
  }

  nature(): string {
    return this.#nature;
  }

  frRefs(): readonly string[] {
    return this.#frRefs;
  }

  assertion(): Expression | undefined {
    return this.#assert;
  }

  trigger(): string | undefined {
    return this.#trigger;
  }

  guard(): Expression | undefined {
    return this.#guard;
  }

  effect(): Expression | undefined {
    return this.#effect;
  }

  temporal(): { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression } | undefined {
    return this.#temporal;
  }

  isEvent(): boolean {
    return this.#trigger !== undefined;
  }
}
