// DesignRecord 集約 — refcheck が検査する「intent record の設計面」の
// 型付きスナップショット。識別は発火対象の成果物パス。Repository の Impl が
// 読み＋解析（形式知識）を所有し、ここには解析済みの型付き視点だけが載る。
// 各値の取得規則（requirements は rules が使えるときだけ・兄弟は catalog が
// 解析できたときだけ等）は Impl が凍結挙動として実装する。
//
// 検査は集約自身の門（種別規律の裁定 16、2026-09-02）: `checkComponents`／
// `checkContracts`／`checkFunctionalDesign` が対象の視点で ReferenceCheckReport
// を開き（検査ファミリーと unit は集約の知識）、検査を走らせ、読んだ文書の
// アンカーを inputs[] に記録して、開いたレポートを返す。対象がその検査の
// 文書でなければ not-applicable（sensor が選ぶ期待分岐）。読み込まれた文書は
// アンカー＋解析結果の対として集約の内側にだけある（旧 LoadedDocument<Outcome>
// は解散）。視点の getter は無い——集約の外に読ませる面は id と原文だけ。
// 各ファミリーの判定は宣言・コレクション・解析結果の不変条件（裁定 11〜13）
// で、門はそれらを凍結の順に呼び、読んだ文書を inputs に記録するだけ。

import { ArtifactPath, type RequirementIds } from "../../kernel/domain/index.ts";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { COMPONENT_FAMILIES } from "./component-check-families.ts";
import { CONTRACT_FAMILIES } from "./contract-check-families.ts";
import { FUNCTIONAL_FAMILIES } from "./functional-check-families.ts";
import { DeclaredUnitsOutcome } from "./declared-units-outcome.ts";
import { DomainEntitiesOutcome } from "./domain-entities-outcome.ts";
import { EntitiesOutcome } from "./entities-outcome.ts";
import { FunctionalSpecOutcome } from "./functional-spec-outcome.ts";
import { RulesOutcome } from "./rules-outcome.ts";
import { ReferenceCheckReport } from "./reference-check-report.ts";
import { ReferenceCheckReportId } from "./reference-check-report-id.ts";
import type { ComponentCatalogOutcome } from "./component-catalog-outcome.ts";
import type { ContractsTableOutcome } from "./contracts-table-outcome.ts";
import type { DesignRecordId } from "./design-record-id.ts";
import type { InputAnchor } from "./input-anchor.ts";
import type { InputAnchors } from "./input-anchors.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";
import type { SpecBlockAssessments } from "./spec-block-assessments.ts";
import type { UnitName } from "../../kernel/domain/index.ts";

// 検査の門が開かない理由：対象成果物がその検査の文書ではない。
type CheckNotApplicable = { readonly kind: "not-applicable" };

export class DesignRecord {
  readonly #id: DesignRecordId;
  // 発火対象の record 相対名と (artifact, sha256)。対象が読めない場合に
  // 集約は作られない（Repository が not-found を返す）。
  readonly #target: InputAnchor;
  // 錨成果物の原文の生バイト列（原文材料——store の往復則 findById∘store が
  // バイト恒等。兄弟成果物は読み取り視点であり store の対象外）。
  readonly #sourceDocument: Uint8Array;
  // 対象が components.md のときだけ載る視点。
  readonly #componentCatalog: ComponentCatalogOutcome | null;
  // 対象が contract-summary.md のときだけ載る視点。
  readonly #contractSummary: Parameters<typeof DesignRecord.reconstitute>[0]["contractSummary"];
  // 対象が functional-design 配下のときだけ載る視点。
  readonly #functional: Parameters<typeof DesignRecord.reconstitute>[0]["functional"];

  private constructor(seed: Parameters<typeof DesignRecord.reconstitute>[0]) {
    this.#id = seed.id;
    this.#target = seed.target;
    this.#sourceDocument = seed.sourceDocument;
    this.#componentCatalog = seed.componentCatalog;
    this.#contractSummary = seed.contractSummary;
    this.#functional = seed.functional;
  }

  // Repository の読出側だけが使う門。読み込まれた文書は (input, outcome) の対。
  static reconstitute(seed: {
    readonly id: DesignRecordId;
    readonly target: InputAnchor;
    readonly sourceDocument: Uint8Array;
    readonly componentCatalog: ComponentCatalogOutcome | null;
    readonly contractSummary: {
      readonly contractsTable: ContractsTableOutcome;
      readonly specBlocks: SpecBlockAssessments;
      readonly declaredUnits: {
        readonly artifactName: ArtifactPath;
        readonly document: { readonly input: InputAnchor; readonly outcome: DeclaredUnitsOutcome } | null;
      };
    } | null;
    readonly functional: {
      readonly unit: UnitName | undefined;
      readonly entitiesArtifact: ArtifactPath;
      readonly entities: { readonly input: InputAnchor; readonly outcome: EntitiesOutcome } | null;
      readonly rulesArtifact: ArtifactPath;
      readonly rules: { readonly input: InputAnchor; readonly outcome: RulesOutcome } | null;
      readonly specArtifact: ArtifactPath;
      readonly spec: { readonly input: InputAnchor; readonly outcome: FunctionalSpecOutcome } | null;
      readonly requirements: { readonly input: InputAnchor; readonly outcome: RequirementIds } | null;
      readonly componentsArtifact: ArtifactPath;
      readonly components: { readonly input: InputAnchor; readonly outcome: DomainEntitiesOutcome } | null;
      readonly siblingUnits: SiblingUnitIndex;
      readonly siblingInputs: InputAnchors;
    } | null;
  }): DesignRecord {
    return new DesignRecord(seed);
  }

  id(): DesignRecordId {
    return this.#id;
  }

  // 境界: store が書く錨成果物の原文（バイト逐語——外部変更を防ぐ防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }

  // components.md の門: DD 検査を走らせ、対象を inputs に記録する。
  checkComponents(reportDirectory: ArtifactPath): Result<ReferenceCheckReport, CheckNotApplicable> {
    const catalog = this.#componentCatalog;
    if (catalog === null) return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(reportDirectory, "components"), COMPONENT_FAMILIES);
    catalog.check(report, ArtifactPath.reconstitute(this.#target.artifact()));
    report.input(this.#target);
    return ok(report);
  }

  // contract-summary.md の門: CD 検査を走らせ、対象と（読めたときは）units
  // エッジ文書を inputs に記録する。
  checkContracts(reportDirectory: ArtifactPath): Result<ReferenceCheckReport, CheckNotApplicable> {
    const summary = this.#contractSummary;
    if (summary === null) return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(reportDirectory, "contract-summary"), CONTRACT_FAMILIES);
    const artifact = ArtifactPath.reconstitute(this.#target.artifact());
    const depArtifact = summary.declaredUnits.artifactName;
    const units = (summary.declaredUnits.document === null ? DeclaredUnitsOutcome.absent() : summary.declaredUnits.document.outcome).check(report);
    const rows = summary.contractsTable.check(report, units, artifact, depArtifact);
    summary.specBlocks.check(report, artifact);
    if (units !== null && rows !== null) units.checkEdgesCovered(rows, report, artifact, depArtifact);
    report.input(this.#target);
    if (summary.declaredUnits.document !== null) report.input(summary.declaredUnits.document.input);
    return ok(report);
  }

  // functional-design の門: FD/XS 検査を unit 付きで走らせ、読めた文書と
  // 兄弟ユニットの entities を inputs に記録する（凍結取得規則は Impl 側）。
  checkFunctionalDesign(reportDirectory: ArtifactPath): Result<ReferenceCheckReport, CheckNotApplicable> {
    const fd = this.#functional;
    if (fd === null) return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(reportDirectory, "functional-design"), FUNCTIONAL_FAMILIES, fd.unit);
    const entities = (fd.entities === null ? EntitiesOutcome.absent() : fd.entities.outcome).check(report, fd.entitiesArtifact);
    (fd.rules === null ? RulesOutcome.absent() : fd.rules.outcome)
      .check(report, fd.rulesArtifact, fd.requirements === null ? null : fd.requirements.outcome, entities);
    (fd.spec === null ? FunctionalSpecOutcome.absent() : fd.spec.outcome)
      .check(report, fd.specArtifact, fd.entitiesArtifact, entities);
    (fd.components === null ? DomainEntitiesOutcome.absent() : fd.components.outcome)
      .check(report, fd.componentsArtifact, fd.siblingUnits, fd.unit);
    if (fd.entities !== null) report.input(fd.entities.input);
    if (fd.rules !== null) report.input(fd.rules.input);
    if (fd.requirements !== null) report.input(fd.requirements.input);
    if (fd.spec !== null) report.input(fd.spec.input);
    if (fd.components !== null) report.input(fd.components.input);
    for (const anchor of fd.siblingInputs) report.input(anchor);
    return ok(report);
  }
}
