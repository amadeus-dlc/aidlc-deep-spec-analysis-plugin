export class ObligationNature {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): ObligationNature {
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
