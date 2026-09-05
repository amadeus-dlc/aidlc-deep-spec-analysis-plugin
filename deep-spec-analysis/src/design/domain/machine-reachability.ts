import { SkipReason, UnitName } from "@deep-spec/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import { DesignFindings } from "./design-findings.ts";
import type { DesignMachine } from "./design-machine.ts";
import type { DesignReport } from "./design-report.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { ReachabilityProbe } from "./reachability-probe.ts";
import type { ReachabilityVerdict } from "./reachability-verdict.ts";

type MachineReachabilityParam = {
  unit: DesignUnit;
  machine: DesignMachine;
  probes: readonly ReachabilityProbe[];
  bounded: boolean;
  observations: ReadonlyMap<ReachabilityProbe, ReachabilityVerdict>;
};

export class MachineReachability {
  readonly #unit: DesignUnit;
  readonly #machine: DesignMachine;
  readonly #probes: readonly ReachabilityProbe[];
  readonly #bounded: boolean;
  readonly #observations: ReadonlyMap<ReachabilityProbe, ReachabilityVerdict>;

  /** 機械一つの候補・観測は各65,536件。全体の合計予算はReachabilityPlanが守る。 */
  private constructor(input: MachineReachabilityParam) {
    if (input.probes.length > 65_536 || input.observations.size > 65_536) {
      throw new IllegalArgumentException({ kind: "too-many-reachability-probes" });
    }
    const probes = [...input.probes];
    const observations = new Map(input.observations);
    const included = new Set(probes);
    for (const probe of observations.keys()) {
      if (!included.has(probe)) throw new IllegalArgumentException({ kind: "reachability-observation-outside-plan" });
    }
    this.#unit = input.unit;
    this.#machine = input.machine;
    this.#probes = probes;
    this.#bounded = input.bounded;
    this.#observations = observations;
  }

  static of(input: MachineReachabilityParam): MachineReachability {
    return new MachineReachability(input);
  }

  static parse(input: MachineReachabilityParam): Result<MachineReachability, ParseError> {
    return parseConstruction(() => new MachineReachability(input));
  }

  probeCount(): number {
    return this.#probes.length;
  }

  *[Symbol.iterator](): Iterator<ReachabilityProbe> {
    if (this.#bounded) yield* this.#probes;
  }

  withVerdict(probe: ReachabilityProbe, verdict: ReachabilityVerdict): MachineReachability {
    if (!this.#probes.includes(probe))
      throw new Error("defect: reachability observation belongs to another machine plan");
    return new MachineReachability({
      unit: this.#unit,
      machine: this.#machine,
      probes: this.#probes,
      bounded: this.#bounded,
      observations: new Map(this.#observations).set(probe, verdict),
    });
  }

  recordedIn(report: DesignReport, capReached: boolean, cap: number): DesignReport {
    if (this.#probes.length === 0) return report;
    let findings = DesignFindings.of([]);
    let skips = DesignSkips.of([]);
    const machine = this.#machine.id().asString();
    const unit = UnitName.of(this.#unit.name());
    if (!this.#bounded) {
      skips = skips.add(
        DesignSkipped.of({
          target: this.#machine.id().asTargetId(),
          reason: SkipReason.capability(),
          unit,
          detail: `unreachable-state detection for ${machine} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${this.#probes.map((probe) => probe.state()).join(", ")})`,
        }),
      );
    } else {
      const leftover: ReachabilityProbe[] = [];
      for (const probe of this.#probes) {
        const observation = this.#observations.get(probe);
        if (observation === undefined) {
          leftover.push(probe);
          continue;
        }
        observation.match({
          reached: () => {},
          unverified: () => {
            leftover.push(probe);
          },
          notReachedWithinBound: () => {
            findings = findings.add(probe.unreachableFinding());
          },
        });
      }
      if (leftover.length > 0)
        skips = skips.add(
          DesignSkipped.of({
            target: this.#machine.id().asTargetId(),
            reason: capReached ? SkipReason.timeout() : SkipReason.unavailable(),
            unit,
            detail: `unreachable-state detection skipped for state(s) ${leftover.map((probe) => probe.state()).join(", ")} of ${machine} (per-run cap ${cap} / budget reached, or the probe run failed)`,
          }),
        );
    }
    return report.withEvidence(findings, skips);
  }
}
