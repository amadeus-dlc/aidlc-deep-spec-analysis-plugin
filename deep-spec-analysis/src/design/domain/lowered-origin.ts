import type { AttributePath } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignMachine } from "./design-machine.ts";
import type { LoweredOriginReference } from "./lowered-origin-reference.ts";
import type { RuleSubsumptionProbe } from "./rule-subsumption-probe.ts";

type LoweredOriginParam =
  | { kind: "passthrough" | "ignore" | "vac-dead"; design: LoweredOriginReference }
  | { kind: "transition"; design: LoweredOriginReference; machine: DesignMachine; attribute: AttributePath }
  | { kind: "vac-shadow"; probe: RuleSubsumptionProbe };

export class LoweredOrigin {
  readonly #value: LoweredOriginParam;
  private constructor(props: LoweredOriginParam) {
    if (
      props.kind === "transition" &&
      (!props.machine.ownsTransition(props.design) || !props.machine.hasAttribute(props.attribute))
    )
      throw new IllegalArgumentException({ kind: "transition-origin-mismatch" });
    this.#value = { ...props };
  }
  static of(props: LoweredOriginParam): LoweredOrigin {
    return new LoweredOrigin(props);
  }
  static parse(props: LoweredOriginParam): Result<LoweredOrigin, ParseError> {
    return parseConstruction(() => new LoweredOrigin(props));
  }
  design(): LoweredOriginReference {
    return this.#value.kind === "vac-shadow" ? this.#value.probe.labelReference() : this.#value.design;
  }
  isKind(kind: LoweredOriginParam["kind"]): boolean {
    return this.#value.kind === kind;
  }
  isSyntheticProbe(): boolean {
    return this.#value.kind === "vac-dead" || this.#value.kind === "vac-shadow";
  }
  subsumptionProbe(): RuleSubsumptionProbe | null {
    return this.#value.kind === "vac-shadow" ? this.#value.probe : null;
  }
  machine(): DesignMachine | null {
    return this.#value.kind === "transition" ? this.#value.machine : null;
  }
  attribute(): AttributePath | null {
    return this.#value.kind === "transition" ? this.#value.attribute : null;
  }
}
