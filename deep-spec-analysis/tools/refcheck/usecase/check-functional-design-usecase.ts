// functional-design の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約を解決し、
// ReferenceCheckReport を開いて FD/XS 検査 → 契約適合 → 永続化を起動する。
// inputs[] の集合は集約が凍結取得規則で解決済みの文書からそのまま導かれる。

import {
  FUNCTIONAL_FAMILIES,
  FunctionalCheckMaterials,
  ReferenceCheckReport,
  ReferenceCheckReportId,
 EntitiesOutcome, RulesOutcome, FunctionalSpecOutcome, DomainEntitiesOutcome,} from "../domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";
import type { CheckFunctionalDesignInput } from "./check-functional-design-input.ts";


export class CheckFunctionalDesignUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
  }

  execute(input: CheckFunctionalDesignInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const fd = record.value.functional();
    if (fd === null) return { kind: "not-applicable" };

    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(input.reportDirectory, "functional-design"), FUNCTIONAL_FAMILIES, fd.unit);
    FunctionalCheckMaterials.of({
      unit: fd.unit,
      entitiesArtifact: fd.entitiesArtifact,
      entities: fd.entities === null ? EntitiesOutcome.absent() : fd.entities.outcome,
      rulesArtifact: fd.rulesArtifact,
      rules: fd.rules === null ? RulesOutcome.absent() : fd.rules.outcome,
      specArtifact: fd.specArtifact,
      spec: fd.spec === null ? FunctionalSpecOutcome.absent() : fd.spec.outcome,
      requirementIdsKnown: fd.requirements === null ? null : fd.requirements.outcome,
      componentsArtifact: fd.componentsArtifact,
      domainEntities: fd.components === null ? DomainEntitiesOutcome.absent() : fd.components.outcome,
      siblingUnits: fd.siblingUnits,
    }).runChecks(report);
    if (fd.entities !== null) report.input(fd.entities.input);
    if (fd.rules !== null) report.input(fd.rules.input);
    if (fd.requirements !== null) report.input(fd.requirements.input);
    if (fd.spec !== null) report.input(fd.spec.input);
    if (fd.components !== null) report.input(fd.components.input);
    for (const anchor of fd.siblingInputs) report.input(anchor);
    // CQS: verdict はモードによらず conformedOf（照会）から導く——store は
    // 書くだけ（void）で、内部で同じ適合を通すため stdout とファイルは
    // 構造的に一致する（凍結挙動）。
    const conformed = this.#referenceCheckReportRepository.conformedOf(report);
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(report);
      if (!stored.ok) return { kind: "save-failed", error: stored.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }
}
