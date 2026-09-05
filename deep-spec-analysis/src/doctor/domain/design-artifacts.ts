import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { DesignArtifactReference } from "./design-artifact-reference.ts";

// doctor一回の対象台帳。後続の観測数も同じ65,536件以内に保つ。
export class DesignArtifacts {
  readonly #values: readonly DesignArtifactReference[];
  private constructor(values: readonly DesignArtifactReference[]) {
    if (values.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-design-artifacts", raw: values.length });
    this.#values = Object.freeze([...values]);
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
