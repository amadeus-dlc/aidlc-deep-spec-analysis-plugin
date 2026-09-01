export class DesignObligationNature {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): DesignObligationNature {
    return new DesignObligationNature(raw);
  }

  equals(other: DesignObligationNature): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isEvent(): boolean {
    return this.#value === "event";
  }

  isInvariant(): boolean {
    return this.#value === "invariant";
  }

  isNumeric(): boolean {
    return this.#value === "numeric";
  }

  isStateTemporal(): boolean {
    return this.#value === "state-temporal";
  }
}
