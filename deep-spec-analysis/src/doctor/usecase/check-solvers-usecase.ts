import type { SolverAvailability } from "@deep-spec/doctor-domain";
import type { SolverProbeClient } from "./port/solver-probe-client.ts";

// ソルバ可用性の打診（checks 配列の第 2 ブロック——全 advisory）。
export class CheckSolversUseCase {
  readonly #probes: SolverProbeClient;

  constructor(probes: SolverProbeClient) {
    this.#probes = probes;
  }

  execute(): SolverAvailability {
    return this.#probes.availability();
  }
}
