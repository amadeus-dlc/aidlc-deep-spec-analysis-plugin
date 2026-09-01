import type { DesignInputAnchor } from "../../design/domain/design-input-anchor.ts";
import { RefinementMap } from "./refinement-map.ts";
export type RefinementMapAcquisition =
  | { readonly kind: "absent"; readonly error: string | null }
  | {
      readonly kind: "loaded";
      readonly map: RefinementMap;
      readonly mapArtifact: string;
      readonly inputs: readonly DesignInputAnchor[];
    };
