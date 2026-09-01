// deep-spec plugin doctor — advisory environment and install checks.
//
// Contract (see docs/reference/18-plugin-mechanism.md): a single JSON object
// on stdout — {"checks":[{pass,label,fix?,severity?}]}. Severity "error"
// fails /aidlc --doctor; "advisory" is displayed only. All solver checks are
// advisory (FR11 / NFR3): a missing solver degrades verification, it never
// blocks the workflow.
//
// 合成ルート（entry、移行 PR9/#22）: env 読取と配線だけを持つ。checks 配列順
// ＝ 5 ユースケースの実行順（マニフェスト → ソルバ → 要件カバレッジ →
// 構造負債 → 設計カバレッジ）は凍結。label/fix の文言は presenter に封じる。

import { join } from "node:path";
import { HealthVerdict } from "./doctor/domain/index.ts";
import {
  CheckFunctionalCoverageUseCase,
  CheckInstallationUseCase,
  CheckSolversUseCase,
  CheckStructuralDebtUseCase,
  CheckVerificationCoverageUseCase,
} from "./doctor/usecase/index.ts";
import {
  DoctorPresenter,
  DoctorWorkspaceClientImpl,
  HarnessFileClientImpl,
  RefcheckBackendClientImpl,
  SolverProbeClientImpl,
} from "./doctor/adapter/index.ts";

function main(): void {
  const projectDir = process.env.AIDLC_PROJECT_DIR || process.cwd();
  const harnessDir = process.env.AIDLC_HARNESS_DIR || ".claude";
  const root = join(projectDir, harnessDir);

  const presenter = new DoctorPresenter({ harnessDir });
  const workspace = new DoctorWorkspaceClientImpl({ projectDir, root });
  const verdict = HealthVerdict.of([
    ...presenter.installation(new CheckInstallationUseCase(new HarnessFileClientImpl({ root })).execute()),
    ...presenter.solvers(
      new CheckSolversUseCase(
        new SolverProbeClientImpl({
          projectDir,
          quintBin: process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint",
          apalacheDistDeclared: Boolean(process.env.APALACHE_DIST),
          homeDir: process.env.HOME ?? "",
        }),
      ).execute(),
    ),
    ...presenter.verificationCoverage(new CheckVerificationCoverageUseCase(workspace).execute()),
    ...presenter.structuralDebt(new CheckStructuralDebtUseCase(workspace, new RefcheckBackendClientImpl({ root })).execute()),
    ...presenter.functionalCoverage(new CheckFunctionalCoverageUseCase(workspace).execute()),
  ]);
  process.stdout.write(`${JSON.stringify(verdict.document())}\n`);
}

main();
