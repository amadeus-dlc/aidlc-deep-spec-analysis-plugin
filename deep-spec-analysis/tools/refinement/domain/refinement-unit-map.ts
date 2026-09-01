import { DesignUnitId } from "../../design/domain/index.ts";
import { AttributeMappings } from "./attribute-mappings.ts";
import { EventMappings } from "./event-mappings.ts";
import { UnmappedDeclarations } from "./unmapped-declarations.ts";

export interface RefinementUnitMap {
  readonly unit: DesignUnitId;
  readonly attrMap: AttributeMappings;
  readonly eventMap: EventMappings;
  readonly unmapped: UnmappedDeclarations;
}
