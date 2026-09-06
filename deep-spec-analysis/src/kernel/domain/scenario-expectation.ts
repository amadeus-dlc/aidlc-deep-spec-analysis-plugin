import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

export class ScenarioExpectation {
  readonly #kind: "accept" | "reject";
  private constructor(value: string) {
    if (value.length > 6)
      throw new IllegalArgumentException({ kind: "scenario-expectation-too-long", raw: value.length });
    if (value !== "accept" && value !== "reject")
      throw new IllegalArgumentException({ kind: "unknown-scenario-expectation", raw: value });
    this.#kind = value;
  }
  static of(value: string): ScenarioExpectation {
    return new ScenarioExpectation(value);
  }
  static parse(value: string): Result<ScenarioExpectation, ParseError> {
    return parseConstruction(() => new ScenarioExpectation(value));
  }
  isAccept(): boolean {
    return this.#kind === "accept";
  }
  isReject(): boolean {
    return this.#kind === "reject";
  }
  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return this.#kind === "accept" ? !satisfiable : satisfiable;
  }
  asString(): "accept" | "reject" {
    return this.#kind;
  }
}
