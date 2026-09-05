export class DesignObligationNature {
  readonly #value: string;

  private constructor(value: Parameters<typeof DesignObligationNature.of>[0]) {
    this.#value = value;
  }

  static of(raw: string): DesignObligationNature {
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
