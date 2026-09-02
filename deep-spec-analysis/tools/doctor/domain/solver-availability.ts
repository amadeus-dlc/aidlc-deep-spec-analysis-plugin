// ソルバ環境の探査結果——z3 パッケージ・node ランタイム・quint CLI・Apalache
// の在否。presenter は 4 つの問いで行を作る（#71 波27）。
export class SolverAvailability {
  readonly #z3Package: boolean;
  readonly #nodeRuntime: boolean;
  readonly #quintCli: boolean;
  readonly #apalache: boolean;

  private constructor(props: { z3Package: boolean; nodeRuntime: boolean; quintCli: boolean; apalache: boolean }) {
    this.#z3Package = props.z3Package;
    this.#nodeRuntime = props.nodeRuntime;
    this.#quintCli = props.quintCli;
    this.#apalache = props.apalache;
  }

  static of(props: { z3Package: boolean; nodeRuntime: boolean; quintCli: boolean; apalache: boolean }): SolverAvailability {
    return new SolverAvailability(props);
  }

  hasZ3Package(): boolean {
    return this.#z3Package;
  }

  hasNodeRuntime(): boolean {
    return this.#nodeRuntime;
  }

  hasQuintCli(): boolean {
    return this.#quintCli;
  }

  hasApalache(): boolean {
    return this.#apalache;
  }
}
