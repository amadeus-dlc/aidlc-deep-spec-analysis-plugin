export interface Z3SolverClientConfiguration {
  readonly selfPath: string;
  readonly perQueryTimeoutMs: number;
  readonly runtimeOverride: string | undefined;
  readonly workingDirectory: string;
}
