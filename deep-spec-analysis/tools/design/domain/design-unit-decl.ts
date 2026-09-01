// 契約3 設計 IR の well-formedness 検査材料。スキーマ検証を通過した設計 IR を、
// アダプタの寛容パースが型付きに解体したもの。ユニットごとの BR 材料
// （construction ディレクトリの有無と rules.md 本文）も、探索と読み込みを
// 済ませた形でここに載る——ドメインは I/O を持たない。
//
// 旧 design-ir-valid センサーの semanticErrors が生 Json を走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移った。

import type { DesignUnitId } from "./design-unit-id.ts";
import { DesignBackgroundDecls } from "./design-background-decls.ts";
import { DesignEntityDecls } from "./design-entity-decls.ts";
import { DesignMachineDecls } from "./design-machine-decls.ts";
import { DesignObligationDecls } from "./design-obligation-decls.ts";
import { DesignScenarioDecls } from "./design-scenario-decls.ts";
import { UnformalizedTargets } from "./unformalized-targets.ts";










export interface DesignUnitDecl {
  readonly unit: DesignUnitId;
  readonly entities: DesignEntityDecls;
  readonly obligations: DesignObligationDecls;
  readonly stateMachines: DesignMachineDecls;
  readonly scenarios: DesignScenarioDecls;
  readonly background: DesignBackgroundDecls;
  readonly unformalizedTargets: UnformalizedTargets;
  // construction/<unit>/ が記録配下に存在するか（記録ルート未解決なら true 扱い
  // ——旧実装は recordRoot === null のときこの検査を出さない）。
  readonly directoryExists: boolean;
  // construction/<unit>/functional-design/rules.md の本文。無ければ null。
  readonly rulesMarkdown: string | null;
}














