import { DesignFindings, DesignSkips } from "../../design/domain/index.ts";

export interface InterpretedRefinementVerdicts {
  findings: DesignFindings;
  skipped: DesignSkips;
}
