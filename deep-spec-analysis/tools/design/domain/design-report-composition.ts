import { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import { CheckedUnits } from "./checked-units.ts";
import { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkips } from "./design-skips.ts";
import { DesignInputAnchors } from "./design-input-anchors.ts";
import type { DesignReportId } from "./design-report-id.ts";

export interface DesignReportComposition {
  readonly id: DesignReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: DesignFindings;
  readonly skipped: DesignSkips;
  readonly inputs?: DesignInputAnchors;
  readonly checked?: CheckedUnits;
  readonly crossChecked?: DesignCrossCheckedEntries;
  readonly unavailableReason?: string;
}
