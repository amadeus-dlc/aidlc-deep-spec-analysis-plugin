import type { ArtifactPath } from "../../kernel/domain/index.ts";
import { type ComponentCatalogOutcome } from "./component-catalog-outcome.ts";

// DD 検査材料——outcome と発火成果物。検査の起動は材料自身の振る舞い
// （OOUI 裁定：旧 runComponentChecks の従属先）。
export interface ComponentCheckMaterialsSeed {
  readonly outcome: ComponentCatalogOutcome;
  readonly artifact: ArtifactPath;
}
