import { SkipReason, UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  combinedHash,
  hashOfBoolean,
  hashOfNullable,
  hashOfString,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
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

const MAX_REACHABILITY_ENTRIES = 65_536;

function boundedObservationSnapshot(
  observations: ReadonlyMap<ReachabilityProbe, ReachabilityVerdict>,
): ReadonlyMap<ReachabilityProbe, ReachabilityVerdict> {
  if (observations.size > MAX_REACHABILITY_ENTRIES)
    throw new IllegalArgumentException({ kind: "too-many-reachability-probes" });
  const snapshot = new Map<ReachabilityProbe, ReachabilityVerdict>();
  let inspected = 0;
  for (const [probe, verdict] of observations) {
    if (inspected >= MAX_REACHABILITY_ENTRIES)
      throw new IllegalArgumentException({ kind: "too-many-reachability-probes", raw: inspected + 1 });
    inspected++;
    snapshot.set(probe, verdict);
  }
  return snapshot;
}

export class MachineReachability {
  readonly #unit: DesignUnit;
  readonly #machine: DesignMachine;
  readonly #probes: readonly ReachabilityProbe[];
  readonly #bounded: boolean;
  readonly #observations: ReadonlyMap<ReachabilityProbe, ReachabilityVerdict>;

  /** 機械一つの候補・観測は各65,536件。全体の合計予算はReachabilityPlanが守る。 */
  private constructor(input: MachineReachabilityParam) {
    const probes = boundedCollectionSnapshot(input.probes, MAX_REACHABILITY_ENTRIES, "too-many-reachability-probes");
    const observations = boundedObservationSnapshot(input.observations);
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

  equals(other: MachineReachability): boolean {
    if (
      !this.#unit.equals(other.#unit) ||
      !this.#machine.equals(other.#machine) ||
      this.#bounded !== other.#bounded ||
      this.#probes.length !== other.#probes.length ||
      this.#observations.size !== other.#observations.size
    )
      return false;
    const probesEqual = this.#probes.every((probe, index) => {
      const otherProbe = other.#probes[index];
      return (
        otherProbe !== undefined &&
        probe.unit().name() === otherProbe.unit().name() &&
        probe.attributePath() === otherProbe.attributePath() &&
        probe.state() === otherProbe.state()
      );
    });
    if (!probesEqual) return false;
    return this.#probes.every((probe, index) => {
      const otherProbe = other.#probes[index];
      const left = this.#observations.get(probe);
      const right = otherProbe === undefined ? undefined : other.#observations.get(otherProbe);
      return left === undefined ? right === undefined : right !== undefined && left.equals(right);
    });
  }

  hashCode(): number {
    return combinedHash([
      this.#unit.hashCode(),
      this.#machine.hashCode(),
      hashOfBoolean(this.#bounded),
      ...this.#probes.map((probe) =>
        combinedHash([
          hashOfString(probe.unit().name()),
          hashOfString(probe.attributePath()),
          hashOfString(probe.state()),
          hashOfNullable(this.#observations.get(probe), (verdict) => verdict.hashCode()),
        ]),
      ),
    ]);
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
