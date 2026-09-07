import type { SolverAvailability } from "@deep-spec-analysis/doctor-domain";
import type { Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { SolverProbeClient } from "./port/solver-probe-client.ts";

// ソルバ可用性の打診（checks 配列の第 2 ブロック——全 advisory）。
export class CheckSolversUseCase {
  readonly #probes: SolverProbeClient;

  constructor(probes: SolverProbeClient) {
    this.#probes = probes;
  }

  execute(): Result<SolverAvailability, RepositoryError> {
    return this.#probes.availability();
  }
}
