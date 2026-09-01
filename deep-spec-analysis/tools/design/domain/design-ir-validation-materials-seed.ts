import type { ErrorMessages, IrVersion } from "../../kernel/domain/index.ts";
import { type DesignUnitDecls } from "./design-unit-decls.ts";
import { DesignIrValidationMaterialsId } from "./design-ir-validation-materials-id.ts";

export interface DesignIrValidationMaterialsSeed {
  readonly id: DesignIrValidationMaterialsId;
  readonly irVersion: IrVersion;
  readonly schemaErrors: ErrorMessages;
  readonly units: DesignUnitDecls;
  readonly sourceDocument: Uint8Array;
}
