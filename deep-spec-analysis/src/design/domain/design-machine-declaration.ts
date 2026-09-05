import type { EnumerationMembers } from "@deep-spec/kernel-domain";

import type { DesignIgnoreDeclarations } from "./design-ignore-declarations.ts";
import type { DesignMachineIdentifier } from "./design-machine-identifier.ts";
import type { DesignTransitionDeclarations } from "./design-transition-declarations.ts";
import type { InitialStates } from "./initial-states.ts";

// 契約3 設計 IR の状態機械宣言（well-formedness 検査材料）。初期状態のうち
// 状態集合に属さないものの選別は宣言自身の知識（#71 波13）。attrPath は
// `<entity>.<attribute>` の結合形（裁定の恒久除外）——どちらかが文字列で
// なければ "?" が入る（凍結）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignMachineDeclarationParam = {
  id: DesignMachineIdentifier;
  attrPath: string;
  initial: InitialStates;
  transitions: DesignTransitionDeclarations;
  ignores: DesignIgnoreDeclarations;
};

export class DesignMachineDeclaration {
  readonly #id: DesignMachineIdentifier;
  readonly #attrPath: string;
  readonly #initial: InitialStates;
  readonly #transitions: DesignTransitionDeclarations;
  readonly #ignores: DesignIgnoreDeclarations;

  private constructor(props: DesignMachineDeclarationParam) {
    this.#id = props.id;
    this.#attrPath = props.attrPath;
    this.#initial = props.initial;
    this.#transitions = props.transitions;
    this.#ignores = props.ignores;
  }

  static of(props: DesignMachineDeclarationParam): DesignMachineDeclaration {
    return new DesignMachineDeclaration(props);
  }

  id(): DesignMachineIdentifier {
    return this.#id;
  }

  attrPath(): string {
    return this.#attrPath;
  }

  initial(): InitialStates {
    return this.#initial;
  }

  transitions(): DesignTransitionDeclarations {
    return this.#transitions;
  }

  ignores(): DesignIgnoreDeclarations {
    return this.#ignores;
  }

  // 初期状態のうち状態集合に属さないもの（宣言順——文言の発生順を決める凍結面）。
  initialStatesOutside(states: EnumerationMembers): string[] {
    return [...this.#initial].filter((state) => !states.includes(state.asString())).map((state) => state.asString());
  }
}
