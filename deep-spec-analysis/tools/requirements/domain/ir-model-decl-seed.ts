import { IrBackgroundDecls } from "./ir-background-decls.ts";
import { IrEntityDecls } from "./ir-entity-decls.ts";
import { IrObligationDecls } from "./ir-obligation-decls.ts";
import { IrScenarioDecls } from "./ir-scenario-decls.ts";

export interface IrModelDeclSeed {
  readonly entities: IrEntityDecls;
  readonly obligations: IrObligationDecls;
  readonly scenarios: IrScenarioDecls;
  readonly background: IrBackgroundDecls;
}
