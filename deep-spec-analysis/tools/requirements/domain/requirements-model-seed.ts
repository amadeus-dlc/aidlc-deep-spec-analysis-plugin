import type { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import { AttributeDeclarations } from "./attribute-declarations.ts";
import { BackgroundAssumptions } from "./background-assumptions.ts";
import type { FormalModelId } from "./formal-model-id.ts";
import { Obligations } from "./obligations.ts";
import { Scenarios } from "./scenarios.ts";

export interface RequirementsModelSeed {
  readonly id: FormalModelId;
  // 生 IR の正準 JSON の sha256（アダプタが導出——文書の同一性照合材料）。
  readonly irHash: ContentHash;
  // 成果物の原文の生バイト列（原文材料——store の往復則 findById∘store がバイト恒等）。
  readonly sourceDocument: Uint8Array;
  readonly irVersion: IrVersion;
  readonly attributes: AttributeDeclarations;
  readonly obligations: Obligations;
  readonly scenarios: Scenarios;
  readonly background: BackgroundAssumptions;
}
