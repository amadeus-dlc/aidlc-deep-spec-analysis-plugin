import type { UnitName } from "@deep-spec/kernel-domain";
import type { ArtifactModifiedAt } from "./artifact-modified-at.ts";

export class FunctionalUnitObservation {
  readonly #name: UnitName;
  readonly #newestArtifact: ArtifactModifiedAt;
  private constructor(name: UnitName, newestArtifact: ArtifactModifiedAt) {
    this.#name = name;
    this.#newestArtifact = newestArtifact;
  }
  static of(name: UnitName, newestArtifact: ArtifactModifiedAt): FunctionalUnitObservation {
    return new FunctionalUnitObservation(name, newestArtifact);
  }
  name(): UnitName {
    return this.#name;
  }
  changedAfter(model: ArtifactModifiedAt): boolean {
    return this.#newestArtifact.isAfter(model);
  }
}
