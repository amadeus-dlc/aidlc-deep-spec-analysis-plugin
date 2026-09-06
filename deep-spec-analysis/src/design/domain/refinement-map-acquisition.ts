import type { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import type { DesignInputAnchors } from "./design-input-anchors.ts";
import type { RefinementMap } from "./refinement-map.ts";

type RefinementMapAcquisitionState =
  | { readonly kind: "absent"; readonly error: string | null }
  | {
      readonly kind: "loaded";
      readonly map: RefinementMap;
      readonly artifact: ArtifactPath;
      readonly inputs: DesignInputAnchors;
    };

// 精緻化写像の取得結果。読めた写像とその取得時の入力証跡を一緒に保持する。
export class RefinementMapAcquisition {
  readonly #state: RefinementMapAcquisitionState;

  private constructor(state: RefinementMapAcquisitionState) {
    this.#state = { ...state };
  }

  static absent(error: string | null): RefinementMapAcquisition {
    return new RefinementMapAcquisition({ kind: "absent", error });
  }

  static loaded(map: RefinementMap, artifact: ArtifactPath, inputs: DesignInputAnchors): RefinementMapAcquisition {
    return new RefinementMapAcquisition({ kind: "loaded", map, artifact, inputs });
  }

  match<T>(handlers: {
    absent: (error: string | null) => T;
    loaded: (map: RefinementMap, artifact: ArtifactPath, inputs: DesignInputAnchors) => T;
  }): T {
    const state = this.#state;
    return state.kind === "absent"
      ? handlers.absent(state.error)
      : handlers.loaded(state.map, state.artifact, state.inputs);
  }
}
