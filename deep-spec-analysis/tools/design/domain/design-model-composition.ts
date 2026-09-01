import type { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import type { DesignModelId } from "./design-model-id.ts";
import { DesignUnits } from "./design-units.ts";

export interface DesignModelComposition {
  readonly id: DesignModelId;
  // 生 IR の正準 JSON の sha256（アダプタが導出——文書の同一性照合材料）。
  readonly irHash: ContentHash;
  // 成果物の原文の生バイト列（原文材料——store の往復則 findById∘store がバイト恒等）。
  readonly sourceDocument: Uint8Array;
  readonly irVersion: IrVersion;
  readonly units: DesignUnits;
}
