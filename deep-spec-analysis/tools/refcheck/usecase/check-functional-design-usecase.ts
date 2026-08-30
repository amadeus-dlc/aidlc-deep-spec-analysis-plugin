// functional-design の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約を解決し、
// FD/XS 検査 → 組成 → 契約適合 → 永続化を起動する。inputs[] の集合は集約が
// 凍結取得規則で解決済みの文書からそのまま導かれる。

import {
  type CheckExecutionMode,
  type DesignRecordId,
  CheckFamilyLedger,
  FUNCTIONAL_FAMILIES,
  type InputAnchor,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  runFunctionalChecks,
} from "../domain/index.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";

export interface CheckFunctionalDesignInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}

export class CheckFunctionalDesignUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;

  constructor(designRecordRepository: DesignRecordRepository, referenceCheckReportRepository: ReferenceCheckReportRepository) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
  }

  execute(input: CheckFunctionalDesignInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const fd = record.value.functional();
    if (fd === null) return { kind: "not-applicable" };

    const ledger = new CheckFamilyLedger(FUNCTIONAL_FAMILIES, fd.unit);
    runFunctionalChecks({
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
    }, ledger);

    const inputs: InputAnchor[] = [];
    if (fd.entities !== null) inputs.push(fd.entities.input);
    if (fd.rules !== null) inputs.push(fd.rules.input);
    if (fd.requirements !== null) inputs.push(fd.requirements.input);
    if (fd.spec !== null) inputs.push(fd.spec.input);
    if (fd.components !== null) inputs.push(fd.components.input);
    inputs.push(...fd.siblingInputs);

    const report = ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "functional-design"),
      inputs,
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
    const conformed = this.#referenceCheckReportRepository.conformedOf(report);
    if (input.mode === "persist") {
      const saved = this.#referenceCheckReportRepository.save(conformed);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }
}
