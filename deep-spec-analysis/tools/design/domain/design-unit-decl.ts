import { type DesignBackgroundDecls } from "./design-background-decls.ts";
import { type DesignEntityDecls } from "./design-entity-decls.ts";
import { type DesignMachineDecls } from "./design-machine-decls.ts";
import { type DesignObligationDecls } from "./design-obligation-decls.ts";
import { type DesignScenarioDecls } from "./design-scenario-decls.ts";
import { type DesignUnitId } from "./design-unit-id.ts";
import { type UnformalizedTargets } from "./unformalized-targets.ts";

// 契約3 設計 IR の well-formedness 検査材料。スキーマ検証を通過した設計 IR を、
// アダプタの寛容パースが型付きに解体したもの。ユニットごとの BR 材料
// （construction ディレクトリの有無と rules.md 本文）も、探索と読み込みを
// 済ませた形でここに載る——ドメインは I/O を持たない。
//
// 旧 design-ir-valid センサーの semanticErrors が生 Json を走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移った。
// construction ディレクトリ欠落の判定は宣言自身の知識（#71 波13）。
export class DesignUnitDecl {
  readonly #unit: DesignUnitId;
  readonly #entities: DesignEntityDecls;
  readonly #obligations: DesignObligationDecls;
  readonly #stateMachines: DesignMachineDecls;
  readonly #scenarios: DesignScenarioDecls;
  readonly #background: DesignBackgroundDecls;
  readonly #unformalizedTargets: UnformalizedTargets;
  // construction/<unit>/ が記録配下に存在するか（記録ルート未解決なら true 扱い
  // ——旧実装は recordRoot === null のときこの検査を出さない）。
  readonly #directoryExists: boolean;
  // construction/<unit>/functional-design/rules.md の本文。無ければ null。
  readonly #rulesMarkdown: string | null;

  private constructor(props: {
    unit: DesignUnitId;
    entities: DesignEntityDecls;
    obligations: DesignObligationDecls;
    stateMachines: DesignMachineDecls;
    scenarios: DesignScenarioDecls;
    background: DesignBackgroundDecls;
    unformalizedTargets: UnformalizedTargets;
    directoryExists: boolean;
    rulesMarkdown: string | null;
  }) {
    this.#unit = props.unit;
    this.#entities = props.entities;
    this.#obligations = props.obligations;
    this.#stateMachines = props.stateMachines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#unformalizedTargets = props.unformalizedTargets;
    this.#directoryExists = props.directoryExists;
    this.#rulesMarkdown = props.rulesMarkdown;
  }

  static reconstitute(props: {
    unit: DesignUnitId;
    entities: DesignEntityDecls;
    obligations: DesignObligationDecls;
    stateMachines: DesignMachineDecls;
    scenarios: DesignScenarioDecls;
    background: DesignBackgroundDecls;
    unformalizedTargets: UnformalizedTargets;
    directoryExists: boolean;
    rulesMarkdown: string | null;
  }): DesignUnitDecl {
    return new DesignUnitDecl(props);
  }

  unit(): DesignUnitId {
    return this.#unit;
  }

  entities(): DesignEntityDecls {
    return this.#entities;
  }

  obligations(): DesignObligationDecls {
    return this.#obligations;
  }

  stateMachines(): DesignMachineDecls {
    return this.#stateMachines;
  }

  scenarios(): DesignScenarioDecls {
    return this.#scenarios;
  }

  background(): DesignBackgroundDecls {
    return this.#background;
  }

  unformalizedTargets(): UnformalizedTargets {
    return this.#unformalizedTargets;
  }

  // 記録配下に construction/<unit>/ が無い（記録ルート未解決なら「ある」扱い）。
  lacksConstructionDirectory(): boolean {
    return !this.#directoryExists;
  }

  rulesMarkdown(): string | null {
    return this.#rulesMarkdown;
  }
}
