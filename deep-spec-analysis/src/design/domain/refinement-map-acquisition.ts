import type { DesignInputAnchor } from "@deep-spec/design-domain";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { RefinementMap } from "./refinement-map.ts";

// refinement map の取得結果——無い（absent：読めなかった理由つき）か、
// 読めた（loaded：map・その成果物パス・入力アンカー）。読み手は `match` で
// 解釈へ命じる——kind を読んで分岐する代わりに（#71 波23）。
export class RefinementMapAcquisition {
  readonly #error: string | null;
  readonly #map: RefinementMap | null;
  readonly #mapArtifact: ArtifactPath | null;
  readonly #inputs: readonly DesignInputAnchor[];

  private constructor(props: {
    error: string | null;
    map: RefinementMap | null;
    mapArtifact: ArtifactPath | null;
    inputs: readonly DesignInputAnchor[];
  }) {
    this.#error = props.error;
    this.#map = props.map;
    this.#mapArtifact = props.mapArtifact;
    this.#inputs = props.inputs;
  }

  static absent(error: string | null): RefinementMapAcquisition {
    return new RefinementMapAcquisition({ error, map: null, mapArtifact: null, inputs: [] });
  }

  static loaded(
    map: RefinementMap,
    mapArtifact: ArtifactPath,
    inputs: readonly DesignInputAnchor[],
  ): RefinementMapAcquisition {
    return new RefinementMapAcquisition({ error: null, map, mapArtifact, inputs });
  }

  match<T>(handlers: {
    absent: (error: string | null) => T;
    loaded: (map: RefinementMap, mapArtifact: ArtifactPath, inputs: readonly DesignInputAnchor[]) => T;
  }): T {
    if (this.#map === null || this.#mapArtifact === null) return handlers.absent(this.#error);
    return handlers.loaded(this.#map, this.#mapArtifact, this.#inputs);
  }
}
