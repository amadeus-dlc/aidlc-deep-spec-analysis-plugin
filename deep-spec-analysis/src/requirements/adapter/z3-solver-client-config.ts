export interface Z3SolverClientConfig {
  readonly selfPath: string;
  readonly perQueryTimeoutMs: number;
  readonly runtimeOverride: string | undefined;
  readonly workingDirectory: string;
}
