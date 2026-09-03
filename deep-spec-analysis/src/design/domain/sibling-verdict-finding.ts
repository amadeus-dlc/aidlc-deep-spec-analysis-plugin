import { type FrRefs, FindingKind } from "@deep-spec/kernel-domain";
import type { DesignWitness } from "./design-witness.ts";
import type { LoweredId } from "./lowered-id.ts";

// 兄弟バックエンドが返した finding 1 件——lowering 側の id で書かれている。
// 判定の再割り当て（LoweredUnit.remapVerdicts）は種類を問い、対象を写像し、
// witness の core 形を finding 自身に書き換えさせる（#71 波23）。
export class SiblingVerdictFinding {
  readonly #kind: FindingKind;
  readonly #frRefs: FrRefs;
  readonly #targets: readonly LoweredId[];
  readonly #witness: DesignWitness;
  readonly #detail: string;

  private constructor(props: { kind: string; frRefs: FrRefs; targets: readonly LoweredId[]; witness: DesignWitness; detail: string }) {
    this.#kind = FindingKind.reconstitute(props.kind);
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }

  static reconstitute(props: { kind: string; frRefs: FrRefs; targets: readonly LoweredId[]; witness: DesignWitness; detail: string }): SiblingVerdictFinding {
    return new SiblingVerdictFinding(props);
  }

  kind(): string {
    return this.#kind.asString();
  }

  isKind(kind: string): boolean {
    return this.#kind.equals(FindingKind.reconstitute(kind));
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

  // core のラベル（lowered id）を design id へ書き換えた witness——形の判定は
  // witness 自身が行う（裁定 2、2026-09-03）。
  witnessRemappedBy(rewrite: (label: string) => string): DesignWitness {
    return this.#witness.remapCore(rewrite);
  }
}
