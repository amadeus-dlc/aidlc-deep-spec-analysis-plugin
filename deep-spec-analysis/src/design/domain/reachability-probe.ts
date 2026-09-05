import {
  type AttributePath,
  type EnumerationMember,
  FindingKind,
  FunctionalRequirementReferences,
  TargetIdentifiers,
  UnitName,
} from "@deep-spec/kernel-domain";
import { DesignFinding } from "./design-finding.ts";
import type { DesignMachine } from "./design-machine.ts";
import type { DesignUnit } from "./design-unit.ts";
import { DesignWitness } from "./design-witness.ts";
import type { LoweredUnit } from "./lowered-unit.ts";

// 一つの状態に対する問い。証跡の帰属と探索範囲を問い自身が保持する。
export class ReachabilityProbe {
  readonly #unit: DesignUnit;
  readonly #lowered: LoweredUnit;
  readonly #machine: DesignMachine;
  readonly #path: AttributePath;
  readonly #state: EnumerationMember;

  private constructor(
    unit: DesignUnit,
    lowered: LoweredUnit,
    machine: DesignMachine,
    path: AttributePath,
    state: EnumerationMember,
  ) {
    this.#unit = unit;
    this.#lowered = lowered;
    this.#machine = machine;
    this.#path = path;
    this.#state = state;
  }

  static of(
    unit: DesignUnit,
    lowered: LoweredUnit,
    machine: DesignMachine,
    path: AttributePath,
    state: EnumerationMember,
  ): ReachabilityProbe {
    return new ReachabilityProbe(unit, lowered, machine, path, state);
  }

  // adapterがプローブ文書を構築するための境界。
  unit(): DesignUnit {
    return this.#unit;
  }
  lowered(): LoweredUnit {
    return this.#lowered;
  }
  attributePath(): string {
    return this.#path.asString();
  }
  state(): string {
    return this.#state.asString();
  }

  unreachableFinding(): DesignFinding {
    return DesignFinding.of({
      kind: FindingKind.unreachable(),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      targets: TargetIdentifiers.of([this.#machine.id().asTargetId()]),
      witness: DesignWitness.model({ [this.#path.asString()]: this.#state.asString() }),
      unit: UnitName.of(this.#unit.name()),
      detail: `State "${this.#state.asString()}" of ${this.#machine.id().asString()} (${this.#path.asString()}) is not reached by any execution within 8 steps from any legal state — it may be dead.`,
    });
  }
}
