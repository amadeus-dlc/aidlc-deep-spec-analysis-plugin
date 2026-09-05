import { CoverageState } from "./coverage-state.ts";
import type { DigestAnchor } from "./digest-anchor.ts";
import type { IntentLocation } from "./intent-location.ts";
import { VerificationStaleness } from "./verification-staleness.ts";

type VerificationObservationParam = {
  location: IntentLocation;
  hasModel: boolean;
  hasFindings: boolean;
  anchor: DigestAnchor | null;
};

// 要件成果物の検証証拠。充足と鮮度の最終判断をこの観測が所有する。
export class VerificationObservation {
  readonly #location: IntentLocation;
  readonly #hasModel: boolean;
  readonly #hasFindings: boolean;
  readonly #anchor: DigestAnchor | null;
  private constructor(props: VerificationObservationParam) {
    this.#location = props.location;
    this.#hasModel = props.hasModel;
    this.#hasFindings = props.hasFindings;
    this.#anchor = props.anchor;
  }
  static of(props: VerificationObservationParam): VerificationObservation {
    return new VerificationObservation(props);
  }
  location(): IntentLocation {
    return this.#location;
  }
  problemState(): CoverageState | null {
    if (!this.#hasModel || !this.#hasFindings) return CoverageState.unverified();
    return VerificationStaleness.of({ anchor: this.#anchor }).isStale() ? CoverageState.stale() : null;
  }
}
