import { FindingKind, type FunctionalRequirementReferences } from "@deep-spec/kernel-domain";
import type { DesignWitness } from "./design-witness.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";

// 兄弟バックエンドが返した finding 1 件——lowering 側の id で書かれている。
// 判定の再割り当て（SiblingVerdictDocument.remapVerdicts）は種類を問い、対象を写像し、
// witness の core 形を finding 自身に書き換えさせる（#71 波23）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SiblingVerdictFindingParam = {
  kind: FindingKind;
  functionalRequirementReferences: FunctionalRequirementReferences;
  targets: readonly LoweredIdentifier[];
  witness: DesignWitness;
  detail: string;
};

export class SiblingVerdictFinding {
  readonly #kind: FindingKind;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #targets: readonly LoweredIdentifier[];
  readonly #witness: DesignWitness;
  readonly #detail: string;

  private constructor(props: SiblingVerdictFindingParam) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = Object.freeze([...props.targets]);
    this.#witness = props.witness;
    this.#detail = props.detail;
  }

  static of(props: SiblingVerdictFindingParam): SiblingVerdictFinding {
    return new SiblingVerdictFinding(props);
  }

  kind(): string {
    return this.#kind.asString();
  }

  // 呼び手はすべてこのファイルの外の domain 判定ロジックが持つ既知の閉集合
  // リテラル（"conflict" 等）——parse の閉集合の門を通す（種別規律の裁定
  // 3-2、2026-09-04）。未知の literal は defect であって finding の #kind とは
  // 決して一致しない。
  isKind(kind: string): boolean {
    const parsed = FindingKind.parse(kind);
    return parsed.ok && this.#kind.equals(parsed.value);
  }

  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }

  targets(): readonly LoweredIdentifier[] {
    return this.#targets;
  }

  detail(): string {
    return this.#detail;
  }

  provesReachabilityOf(attrPath: string, state: string): boolean {
    return this.isKind("conflict") && this.#witness.reachesState(attrPath, state);
  }

  // core のラベル（lowered id）を design id へ書き換えた witness——形の判定は
  // witness 自身が行う（裁定 2、2026-09-03）。
  witnessRemappedBy(rewrite: (label: string) => string): DesignWitness {
    return this.#witness.remapCore(rewrite);
  }
}
