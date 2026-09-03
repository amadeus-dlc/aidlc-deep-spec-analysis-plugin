export interface RefinementSolverClientConfig {
  readonly childHostPath: string;
  readonly perQueryTimeoutMs: number;
  readonly runtimeOverride: string | undefined;
  readonly workingDirectory: string;
}
