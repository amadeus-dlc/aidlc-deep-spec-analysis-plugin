export class ObligationNature {
  readonly #value: string;

  private constructor(value: Parameters<typeof ObligationNature.of>[0]) {
    this.#value = value;
  }

  static of(raw: string): ObligationNature {
    return new ObligationNature(raw);
  }

  equals(other: ObligationNature): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isInvariant(): boolean {
    return this.#value === "invariant";
  }

  isNumeric(): boolean {
    return this.#value === "numeric";
  }

  isEvent(): boolean {
    return this.#value === "event";
  }

  isStateTemporal(): boolean {
    return this.#value === "state-temporal";
  }
}
