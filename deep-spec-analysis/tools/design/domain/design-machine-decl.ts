import { type DeclaredValues } from "./declared-values.ts";
import { type DesignIgnoreDecls } from "./design-ignore-decls.ts";
import { type DesignMachineId } from "./design-machine-id.ts";
import { type DesignTransitionDecls } from "./design-transition-decls.ts";
import { type InitialStates } from "./initial-states.ts";

// 契約3 設計 IR の状態機械宣言（well-formedness 検査材料）。初期状態のうち
// 状態集合に属さないものの選別は宣言自身の知識（#71 波13）。attrPath は
// `<entity>.<attribute>` の結合形（裁定の恒久除外）——どちらかが文字列で
// なければ "?" が入る（凍結）。
export class DesignMachineDecl {
  readonly #id: DesignMachineId;
  readonly #attrPath: string;
  readonly #initial: InitialStates;
  readonly #transitions: DesignTransitionDecls;
  readonly #ignores: DesignIgnoreDecls;

  private constructor(props: { id: DesignMachineId; attrPath: string; initial: InitialStates; transitions: DesignTransitionDecls; ignores: DesignIgnoreDecls }) {
    this.#id = props.id;
    this.#attrPath = props.attrPath;
    this.#initial = props.initial;
    this.#transitions = props.transitions;
    this.#ignores = props.ignores;
  }

  static reconstitute(props: { id: DesignMachineId; attrPath: string; initial: InitialStates; transitions: DesignTransitionDecls; ignores: DesignIgnoreDecls }): DesignMachineDecl {
    return new DesignMachineDecl(props);
  }

  id(): DesignMachineId {
    return this.#id;
  }

  attrPath(): string {
    return this.#attrPath;
  }

  initial(): InitialStates {
    return this.#initial;
  }

  transitions(): DesignTransitionDecls {
    return this.#transitions;
  }

  ignores(): DesignIgnoreDecls {
    return this.#ignores;
  }

  // 初期状態のうち状態集合に属さないもの（宣言順——文言の発生順を決める凍結面）。
  initialStatesOutside(states: DeclaredValues): string[] {
    return [...this.#initial].filter((state) => !states.includes(state));
  }
}
