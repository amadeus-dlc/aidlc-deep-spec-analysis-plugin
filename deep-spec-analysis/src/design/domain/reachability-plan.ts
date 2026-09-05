import { AttributePath, EnumerationMember, type VerificationMethod } from "@deep-spec/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import { DesignMachines } from "./design-machines.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { LoweredUnit } from "./lowered-unit.ts";
import { MachineReachability } from "./machine-reachability.ts";
import { ReachabilityProbe } from "./reachability-probe.ts";

// 機械順・初期状態除外・検査手法の適用可能性は計画の責務。
export class ReachabilityPlan {
  readonly #machines: readonly MachineReachability[];

  /** 1ユニットで65,536機械・総計65,536候補。多段集合で上限を乗算しない。 */
  private constructor(machines: readonly MachineReachability[]) {
    if (machines.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-reachability-machines", raw: machines.length });
    const owned = [...machines];
    let probes = 0;
    for (const machine of owned) {
      probes += machine.probeCount();
      if (probes > 65_536) throw new IllegalArgumentException({ kind: "too-many-reachability-probes", raw: probes });
    }
    this.#machines = owned;
  }

  static of(machines: readonly MachineReachability[]): ReachabilityPlan {
    return new ReachabilityPlan(machines);
  }

  static parse(machines: readonly MachineReachability[]): Result<ReachabilityPlan, ParseError> {
    return parseConstruction(() => new ReachabilityPlan(machines));
  }

  static forUnit(unit: DesignUnit, lowered: LoweredUnit, method: VerificationMethod): ReachabilityPlan {
    const machines: MachineReachability[] = [];
    for (const machine of unit.machines().sortedById()) {
      const path = lowered.index().attrPathOfMachine(machine.id().asString()) ?? DesignMachines.attrPathOf(machine);
      const probes = machine
        .nonInitialCandidates(unit.enumValuesOf(path))
        .map((state) =>
          ReachabilityProbe.of(unit, lowered, machine, AttributePath.of(path), EnumerationMember.of(state)),
        );
      machines.push(
        MachineReachability.of({
          unit,
          machine,
          probes,
          bounded: method.asString() === "bounded",
          observations: new Map(),
        }),
      );
    }
    return new ReachabilityPlan(machines);
  }

  *[Symbol.iterator](): Iterator<MachineReachability> {
    yield* this.#machines;
  }
}
