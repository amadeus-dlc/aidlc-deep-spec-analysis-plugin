import { DesignIgnoreDecls } from "./design-ignore-decls.ts";
import { type DesignMachineId } from "./design-machine-id.ts";
import { DesignTransitionDecls } from "./design-transition-decls.ts";
import { InitialStates } from "./initial-states.ts";

export interface DesignMachineDecl {
  readonly id: DesignMachineId;
  // `<entity>.<attribute>`。どちらかが文字列でなければ "?" が入る（凍結）。
  readonly attrPath: string;
  readonly initial: InitialStates;
  readonly transitions: DesignTransitionDecls;
  readonly ignores: DesignIgnoreDecls;
}
