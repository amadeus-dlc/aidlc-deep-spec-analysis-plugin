// ソルバ環境の探査結果——z3 パッケージ・node ランタイム・quint CLI・Apalache
// の在否。presenter は 4 つの問いで行を作る（#71 波27）。
//
// Apalache だけは「配布物と JDK が在る」ことと「実際に verify できる」ことが
// 割れる（issue #128）: 8822 番で待ち受けている孤児サーバは消えた作業
// ディレクトリを掴んだまま ping には答えるので、静的検査は通るのに verify は
// 必ず落ちる。stale をもう 1 つの面として持ち、hasApalache() は「在る かつ
// 陳腐化していない」を答える。
export class SolverAvailability {
  readonly #z3Package: boolean;
  readonly #nodeRuntime: boolean;
  readonly #quintCli: boolean;
  readonly #apalache: boolean;
  readonly #apalacheServerStale: boolean;

  private constructor(props: Parameters<typeof SolverAvailability.of>[0]) {
    this.#z3Package = props.z3Package;
    this.#nodeRuntime = props.nodeRuntime;
    this.#quintCli = props.quintCli;
    this.#apalache = props.apalache;
    this.#apalacheServerStale = props.apalacheServerStale;
  }

  static of(props: { z3Package: boolean; nodeRuntime: boolean; quintCli: boolean; apalache: boolean; apalacheServerStale: boolean }): SolverAvailability {
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
    return this.#apalache && !this.#apalacheServerStale;
  }

  apalacheServerIsStale(): boolean {
    return this.#apalacheServerStale;
  }
}
