import type { ErrorMessages, IrVersion } from "../../kernel/domain/index.ts";
import { FrRefClaims } from "./fr-ref-claims.ts";
import type { IrModelDecl } from "./ir-model-decl.ts";
import { IrValidationMaterialsId } from "./ir-validation-materials-id.ts";
import type { RequirementsSourceId } from "./requirements-source-id.ts";

export interface IrValidationMaterialsSeed {
  readonly id: IrValidationMaterialsId;
  readonly irVersion: IrVersion;
  readonly schemaErrors: ErrorMessages;
  readonly view: IrModelDecl;
  readonly frClaims: FrRefClaims;
  // IR の sourceDigest。文字列でなければ null（宣言なし）。
  readonly declaredDigest: string | null;
  readonly sourceId: RequirementsSourceId;
  readonly sourceDocument: Uint8Array;
}
