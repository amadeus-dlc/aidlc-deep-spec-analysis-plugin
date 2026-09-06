import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignArtifactReference } from "./design-artifact-reference.ts";

// doctor一回の対象台帳。後続の観測数も同じ65,536件以内に保つ。
export class DesignArtifacts
  extends FirstClassCollectionBase<DesignArtifactReference, DesignArtifacts>
  implements FirstClassCollection<DesignArtifactReference>
{
  readonly #values: readonly DesignArtifactReference[];
  private constructor(values: readonly DesignArtifactReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-artifacts");
  }

  protected rebuild(values: readonly DesignArtifactReference[]): DesignArtifacts {
    return new DesignArtifacts(values);
  }
  static of(values: readonly DesignArtifactReference[]): DesignArtifacts {
    return new DesignArtifacts(values);
  }
  static parse(values: readonly DesignArtifactReference[]): Result<DesignArtifacts, ParseError> {
    return parseConstruction(() => new DesignArtifacts(values));
  }
  *[Symbol.iterator](): Iterator<DesignArtifactReference> {
    yield* this.#values;
  }
}
