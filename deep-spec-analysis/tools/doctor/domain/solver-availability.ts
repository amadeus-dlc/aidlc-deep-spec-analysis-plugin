// ソルバ環境の可用性事実。すべて advisory（欠如は検証を劣化させるだけで、
// ワークフローを止めない——FR11 / NFR3）。
export interface SolverAvailability {
  z3Package: boolean;
  nodeRuntime: boolean;
  quintCli: boolean;
  apalache: boolean;
}
