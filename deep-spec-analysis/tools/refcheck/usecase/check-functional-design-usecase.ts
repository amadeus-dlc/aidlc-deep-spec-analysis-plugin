// functional-design の refcheck ユースケース — 型付き入力の上で FD/XS 検査を
// 走らせ、ReferenceCheckReport 集約を組む純粋なアプリケーション操作。
// inputs[] の記録規則（存在した成果物のみ・自ユニットの entities.md と同一
// パスの兄弟は重複記録しない）は凍結挙動をここで再現する。

import { sha256 } from "../../kernel/domain/index.ts";
import {
  CheckFamilyLedger,
  type DomainEntitiesOutcome,
  type EntitiesOutcome,
  FUNCTIONAL_FAMILIES,
  type FunctionalSpecOutcome,
  type InputEntry,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  type RulesOutcome,
  type SiblingUnitEntities,
  runFunctionalChecks,
} from "../domain/index.ts";

export interface NamedArtifact {
  readonly artifact: string;
  readonly text: string;
}

export interface CheckFunctionalDesignInput {
  readonly reportDirectory: string;
  readonly unit: string | undefined;
  readonly entitiesArtifact: string;
  readonly entitiesDocument: NamedArtifact | null;
  readonly entities: EntitiesOutcome;
  readonly rulesArtifact: string;
  readonly rulesDocument: NamedArtifact | null;
  readonly rules: RulesOutcome;
  readonly specArtifact: string;
  readonly specDocument: NamedArtifact | null;
  readonly spec: FunctionalSpecOutcome;
  readonly requirementsDocument: NamedArtifact | null;
  readonly requirementIdsKnown: ReadonlySet<string> | null;
  readonly componentsArtifact: string;
  readonly componentsDocument: NamedArtifact | null;
  readonly domainEntities: DomainEntitiesOutcome;
  readonly siblingUnits: SiblingUnitEntities;
  // 兄弟ユニットの entities.md（入力記録用。自ユニットの entities.md と同一
  // パスのものは除外済みで渡される）。
  readonly siblingDocuments: readonly NamedArtifact[];
}

export class CheckFunctionalDesignUseCase {
  execute(input: CheckFunctionalDesignInput): ReferenceCheckReport {
    const ledger = new CheckFamilyLedger(FUNCTIONAL_FAMILIES, input.unit);
    runFunctionalChecks({
      unit: input.unit,
      entitiesArtifact: input.entitiesArtifact,
      entities: input.entities,
      rulesArtifact: input.rulesArtifact,
      rules: input.rules,
      specArtifact: input.specArtifact,
      spec: input.spec,
      requirementIdsKnown: input.requirementIdsKnown,
      componentsArtifact: input.componentsArtifact,
      domainEntities: input.domainEntities,
      siblingUnits: input.siblingUnits,
    }, ledger);

    const inputs: InputEntry[] = [];
    const record = (doc: NamedArtifact | null): void => {
      if (doc !== null) inputs.push({ artifact: doc.artifact, sha256: sha256(doc.text) });
    };
    record(input.entitiesDocument);
    record(input.rulesDocument);
    // FD-R3 が実際に走った（requirements が読めた）ときだけ記録する凍結挙動。
    if (input.requirementIdsKnown !== null) record(input.requirementsDocument);
    record(input.specDocument);
    record(input.componentsDocument);
    for (const doc of input.siblingDocuments) record(doc);

    return ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "functional-design"),
      inputs,
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
  }
}
