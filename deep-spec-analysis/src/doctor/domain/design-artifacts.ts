import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignArtifactReference } from "./design-artifact-reference.ts";
import { StructuralDebt } from "./structural-debt.ts";
import type { StructuralObservation } from "./structural-observation.ts";

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

  protected override rebuild(values: readonly DesignArtifactReference[]): DesignArtifacts {
    return new DesignArtifacts(values);
  }
  static of(values: readonly DesignArtifactReference[]): DesignArtifacts {
    return new DesignArtifacts(values);
  }
  override map(transform: (element: DesignArtifactReference) => DesignArtifactReference): DesignArtifacts {
    return this.mapTo(transform, DesignArtifacts.of);
  }

  override combine(other: DesignArtifacts): DesignArtifacts {
    return this.combineTo(other, DesignArtifacts.of);
  }

  static parse(values: readonly DesignArtifactReference[]): Result<DesignArtifacts, ParseError> {
    return parseConstruction(() => new DesignArtifacts(values));
  }
  override *[Symbol.iterator](): Iterator<DesignArtifactReference> {
    yield* this.#values;
  }

  // 台帳の成果物すべてを観測子にかけ、走査順のまま構造負債にまとめる。
  observedBy(observe: (artifact: DesignArtifactReference) => StructuralObservation): StructuralDebt {
    return StructuralDebt.of(this.#values.map((artifact) => observe(artifact)));
  }
}
