import type { ContentHash } from "../../kernel/domain/index.ts";
import type { RefinementMapId } from "./refinement-map-id.ts";
import { RefinementUnitMaps } from "./refinement-unit-maps.ts";

export interface RefinementMapSeed {
  readonly id: RefinementMapId;
  readonly requirementsIrHash: ContentHash;
  readonly designIrHash: ContentHash;
  readonly units: RefinementUnitMaps;
  // 成果物の原文（原文材料——store の往復則 findById∘store がバイト恒等）。
  readonly sourceDocument: Uint8Array;
}
