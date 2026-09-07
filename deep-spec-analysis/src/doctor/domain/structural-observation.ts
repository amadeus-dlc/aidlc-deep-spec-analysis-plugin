import type { ErrorMessage } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfNumber, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignArtifactReference } from "./design-artifact-reference.ts";
import type { FindingCount } from "./finding-count.ts";

type StructuralObservationState =
  | { readonly kind: "complete"; readonly findings: FindingCount }
  | { readonly kind: "partial"; readonly findings: FindingCount; readonly reason: ErrorMessage }
  | { readonly kind: "unavailable"; readonly reason: ErrorMessage };

export class StructuralObservation {
  readonly #artifact: DesignArtifactReference;
  readonly #state: StructuralObservationState;
  private constructor(artifact: DesignArtifactReference, state: StructuralObservationState) {
    this.#artifact = artifact;
    this.#state = state;
  }

  static of(artifact: DesignArtifactReference, findings: FindingCount): StructuralObservation {
    return new StructuralObservation(artifact, { kind: "complete", findings });
  }

  static partial(
    artifact: DesignArtifactReference,
    findings: FindingCount,
    reason: ErrorMessage,
  ): StructuralObservation {
    return new StructuralObservation(artifact, { kind: "partial", findings, reason });
  }

  static unavailable(artifact: DesignArtifactReference, reason: ErrorMessage): StructuralObservation {
    return new StructuralObservation(artifact, { kind: "unavailable", reason });
  }

  wasScanned(): boolean {
    return this.#state.kind !== "unavailable";
  }

  isComplete(): boolean {
    return this.#state.kind === "complete";
  }

  hasDebt(): boolean {
    return this.#state.kind !== "unavailable" && !this.#state.findings.isEmpty();
  }

  artifact(): DesignArtifactReference {
    return this.#artifact;
  }

  match<T>(handlers: {
    complete: (findings: FindingCount) => T;
    partial: (findings: FindingCount, reason: ErrorMessage) => T;
    unavailable: (reason: ErrorMessage) => T;
  }): T {
    if (this.#state.kind === "complete") return handlers.complete(this.#state.findings);
    if (this.#state.kind === "partial") return handlers.partial(this.#state.findings, this.#state.reason);
    return handlers.unavailable(this.#state.reason);
  }

  equals(other: StructuralObservation): boolean {
    if (!this.#artifact.equals(other.#artifact) || this.#state.kind !== other.#state.kind) return false;
    if (this.#state.kind === "unavailable" && other.#state.kind === "unavailable")
      return this.#state.reason.equals(other.#state.reason);
    if (this.#state.kind === "complete" && other.#state.kind === "complete")
      return this.#state.findings.asNumber() === other.#state.findings.asNumber();
    if (this.#state.kind === "partial" && other.#state.kind === "partial")
      return (
        this.#state.findings.asNumber() === other.#state.findings.asNumber() &&
        this.#state.reason.equals(other.#state.reason)
      );
    return false;
  }

  hashCode(): number {
    if (this.#state.kind === "complete")
      return combinedHash([
        this.#artifact.hashCode(),
        hashOfString(this.#state.kind),
        hashOfNumber(this.#state.findings.asNumber()),
      ]);
    if (this.#state.kind === "partial")
      return combinedHash([
        this.#artifact.hashCode(),
        hashOfString(this.#state.kind),
        hashOfNumber(this.#state.findings.asNumber()),
        this.#state.reason.hashCode(),
      ]);
    return combinedHash([this.#artifact.hashCode(), hashOfString(this.#state.kind), this.#state.reason.hashCode()]);
  }
}
