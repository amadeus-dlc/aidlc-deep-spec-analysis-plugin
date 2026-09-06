import type { BackendName } from "./backend-name.ts";
import type { ContentHash } from "./content-hash.ts";

import type { TargetIdentifier } from "./target-identifier.ts";
import type { UnitName } from "./unit-name.ts";

type ScenarioVerdictState = "clean" | "violated" | "skipped" | "unavailable";

// 一つのバックエンドが同じシナリオについて返した判定。未検査はcleanに含めない。
export class ScenarioVerdict {
  readonly #backend: BackendName;
  readonly #modelHash: ContentHash;
  readonly #state: ScenarioVerdictState;
  readonly #target: TargetIdentifier;
  readonly #unit: UnitName | null;

  private constructor(
    backend: BackendName,
    modelHash: ContentHash,
    target: TargetIdentifier,
    unit: UnitName | null,
    state: ScenarioVerdictState,
  ) {
    this.#backend = backend;
    this.#modelHash = modelHash;
    this.#state = state;
    this.#target = target;
    this.#unit = unit;
  }

  static clean(
    backend: BackendName,
    modelHash: ContentHash,
    target: TargetIdentifier,
    unit: UnitName | null,
  ): ScenarioVerdict {
    return new ScenarioVerdict(backend, modelHash, target, unit, "clean");
  }
  static violated(
    backend: BackendName,
    modelHash: ContentHash,
    target: TargetIdentifier,
    unit: UnitName | null,
  ): ScenarioVerdict {
    return new ScenarioVerdict(backend, modelHash, target, unit, "violated");
  }
  static skipped(
    backend: BackendName,
    modelHash: ContentHash,
    target: TargetIdentifier,
    unit: UnitName | null,
  ): ScenarioVerdict {
    return new ScenarioVerdict(backend, modelHash, target, unit, "skipped");
  }
  static unavailable(
    backend: BackendName,
    modelHash: ContentHash,
    target: TargetIdentifier,
    unit: UnitName | null,
  ): ScenarioVerdict {
    return new ScenarioVerdict(backend, modelHash, target, unit, "unavailable");
  }

  backend(): BackendName {
    return this.#backend;
  }
  isComparable(): boolean {
    return this.#state === "clean" || this.#state === "violated";
  }
  isFor(target: TargetIdentifier, unit: UnitName | null): boolean {
    return (
      this.#target.equals(target) && (this.#unit === null ? unit === null : unit !== null && this.#unit.equals(unit))
    );
  }
  sameSubjectAs(other: ScenarioVerdict): boolean {
    return this.#modelHash.equals(other.#modelHash) && this.isFor(other.#target, other.#unit);
  }
  agreesWith(other: ScenarioVerdict): boolean {
    return this.#state === other.#state;
  }

  equals(other: ScenarioVerdict): boolean {
    return (
      this.#backend.equals(other.#backend) &&
      this.#modelHash.equals(other.#modelHash) &&
      this.#state === other.#state &&
      this.#target.equals(other.#target) &&
      (this.#unit === null ? other.#unit === null : other.#unit !== null && this.#unit.equals(other.#unit))
    );
  }
  // 判定表の表示語彙。未検査を判定表へ載せる呼び出しは契約違反。
  verdictLabel(): "clean" | "violated" {
    if (this.#state !== "clean" && this.#state !== "violated")
      throw new Error("defect: an unverified scenario has no verdict label");
    return this.#state;
  }
}
