// functional-design の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約を解決し、
// FD/XS 検査 → 組成 → 契約適合 → 永続化を起動する。inputs[] の集合は集約が
// 凍結取得規則で解決済みの文書からそのまま導かれる。

import {
  type CheckExecutionMode,
  type DesignRecordId,
  CheckFamilyLedger,
  InputAnchors,
  FUNCTIONAL_FAMILIES,
  FunctionalCheckMaterials,
  ReferenceCheckReport,
  ReferenceCheckReportId,
} from "../domain/index.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./design-record-repository.ts";
import type { ReferenceCheckReportConformance } from "./reference-check-report-conformance.ts";
import type { ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";

export interface CheckFunctionalDesignInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}

export class CheckFunctionalDesignUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;
  readonly #referenceCheckReportConformance: ReferenceCheckReportConformance;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
    referenceCheckReportConformance: ReferenceCheckReportConformance,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
    this.#referenceCheckReportConformance = referenceCheckReportConformance;
  }

  execute(input: CheckFunctionalDesignInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const fd = record.value.functional();
    if (fd === null) return { kind: "not-applicable" };

    const ledger = CheckFamilyLedger.of(FUNCTIONAL_FAMILIES, fd.unit);
    FunctionalCheckMaterials.of({
      unit: fd.unit,
      entitiesArtifact: fd.entitiesArtifact,
      entities: fd.entities === null ? { kind: "absent" } : fd.entities.outcome,
      rulesArtifact: fd.rulesArtifact,
      rules: fd.rules === null ? { kind: "absent" } : fd.rules.outcome,
      specArtifact: fd.specArtifact,
      spec: fd.spec === null ? { kind: "absent" } : fd.spec.outcome,
      requirementIdsKnown: fd.requirements === null ? null : fd.requirements.outcome,
      componentsArtifact: fd.componentsArtifact,
      domainEntities: fd.components === null ? { kind: "absent" } : fd.components.outcome,
      siblingUnits: fd.siblingUnits,
    }).runChecks(ledger);

    let inputs = InputAnchors.of([]);
    if (fd.entities !== null) inputs = inputs.add(fd.entities.input);
    if (fd.rules !== null) inputs = inputs.add(fd.rules.input);
    if (fd.requirements !== null) inputs = inputs.add(fd.requirements.input);
    if (fd.spec !== null) inputs = inputs.add(fd.spec.input);
    if (fd.components !== null) inputs = inputs.add(fd.components.input);
    inputs = inputs.addAll(fd.siblingInputs);

    const report = ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "functional-design"),
      inputs,
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
    // persist は store（適合を内包し書かれた姿を返す）、report-only は適合だけを
    // 問う——どちらの verdict も「書かれる(はずの)姿」から導く（凍結挙動）。
    let conformed: ReferenceCheckReport;
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(report);
      if (!stored.ok) return { kind: "save-failed", error: stored.error };
      conformed = stored.value;
    } else {
      conformed = this.#referenceCheckReportConformance.conformedOf(report);
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }
}
