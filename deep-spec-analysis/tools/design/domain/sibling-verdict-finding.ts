import type { FrRefs } from "../../kernel/domain/index.ts";
import type { DesignValue } from "./design-value.ts";
import type { LoweredId } from "./lowered-id.ts";

// 兄弟バックエンドが返した finding 1 件——lowering 側の id で書かれている。
// 判定の再割り当て（LoweredUnit.remapVerdicts）は種類を問い、対象を写像し、
// witness の core 形を finding 自身に書き換えさせる（#71 波23）。
export class SiblingVerdictFinding {
  readonly #kind: string;
  readonly #frRefs: FrRefs;
  readonly #targets: readonly LoweredId[];
  readonly #witness: DesignValue;
  readonly #detail: string;

  private constructor(props: { kind: string; frRefs: FrRefs; targets: readonly LoweredId[]; witness: DesignValue; detail: string }) {
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }

  static reconstitute(props: { kind: string; frRefs: FrRefs; targets: readonly LoweredId[]; witness: DesignValue; detail: string }): SiblingVerdictFinding {
    return new SiblingVerdictFinding(props);
  }

  kind(): string {
    return this.#kind;
  }

  isKind(kind: string): boolean {
    return this.#kind === kind;
  }

  frRefs(): FrRefs {
    return this.#frRefs;
  }

  targets(): readonly LoweredId[] {
    return this.#targets;
  }

  detail(): string {
    return this.#detail;
  }

  // witness が unsat core（`{ core: [...] }`）の形なら core だけを書き換えて
  // 返し、それ以外の witness はそのまま運ぶ。
  witnessWithCoreRemapped(remapCore: (core: DesignValue) => DesignValue): DesignValue {
    const witness = this.#witness;
    if (witness !== null && typeof witness === "object" && !Array.isArray(witness) && "core" in witness) {
      return { core: remapCore(witness.core ?? null) };
    }
    return witness;
  }
}
