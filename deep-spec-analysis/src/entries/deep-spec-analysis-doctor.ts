// deep-spec plugin doctor — advisory environment and install checks.
//
// Contract (see docs/reference/18-plugin-mechanism.md): a single JSON object
// on stdout — {"checks":[{pass,label,fix?,severity?}]}. Severity "error"
// fails /aidlc --doctor; "advisory" is displayed only. All solver checks are
// advisory (FR11 / NFR3): a missing solver degrades verification, it never
// blocks the workflow.
//
// 合成ルート（entry、移行 PR9/#22）: env 読取と配線だけを持つ。checks 配列順
// ＝ 6 ユースケースの実行順（マニフェスト → version advisory → ソルバ →
// 要件カバレッジ → 構造負債 → 設計カバレッジ）は凍結。version 行は既存の
// installation ブロック直後へ挿入し、既存行同士の順序は変えない。

import { join } from "node:path";
import { HealthVerdict } from "@deep-spec/doctor-domain";
import {
  CheckFunctionalCoverageUseCase,
  CheckInstallationUseCase,
  CheckVersionAdvisoryUseCase,
  CheckSolversUseCase,
  CheckStructuralDebtUseCase,
  CheckVerificationCoverageUseCase,
} from "@deep-spec/doctor-usecase";
import {
  DoctorPresenter,
  DoctorWorkspaceClientImplementation,
  GitHubReleaseTagsClientImplementation,
  HarnessFileClientImplementation,
  InstallationProvenanceClientImplementation,
  ReferenceCheckBackendClientImplementation,
  SolverProbeClientImplementation,
} from "@deep-spec/doctor-adapter";

async function main(): Promise<void> {
  const projectDir = process.env.AIDLC_PROJECT_DIR || process.cwd();
  const harnessDir = process.env.AIDLC_HARNESS_DIR || ".claude";
  const root = join(projectDir, harnessDir);

  const presenter = new DoctorPresenter({ harnessDir });
  const workspace = new DoctorWorkspaceClientImplementation({
    projectDir,
    root,
    refcheckToolNames: {
      domain: "aidlc-sensor-deep-spec-refcheck-domain.ts",
      contract: "aidlc-sensor-deep-spec-refcheck-contract.ts",
      functional: "aidlc-sensor-deep-spec-refcheck-functional.ts",
    },
  });
  const verdict = HealthVerdict.of([
    ...presenter.installation(new CheckInstallationUseCase(new HarnessFileClientImplementation({ root })).execute()),
    presenter.version(await new CheckVersionAdvisoryUseCase(
      new InstallationProvenanceClientImplementation({ harnessRoot: root }),
      new GitHubReleaseTagsClientImplementation({ repository: "j5ik2o/deep-spec-analysis" }),
    ).execute()),
    ...presenter.solvers(
      new CheckSolversUseCase(
        new SolverProbeClientImplementation({
          projectDir,
          quintBin: process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint",
          apalacheDistDeclared: Boolean(process.env.APALACHE_DIST),
          homeDir: process.env.HOME ?? "",
          // quint 0.32 の既定エンドポイント。ここの待ち受けが陳腐化しているか
          // どうかで Apalache 行の意味が決まる（issue #128）。
          apalachePort: 8822,
          runtimeBin: process.execPath,
        }),
      ).execute(),
    ),
    ...presenter.verificationCoverage(new CheckVerificationCoverageUseCase(workspace).execute()),
    ...presenter.structuralDebt(new CheckStructuralDebtUseCase(workspace, new ReferenceCheckBackendClientImplementation({ root })).execute()),
    ...presenter.functionalCoverage(new CheckFunctionalCoverageUseCase(workspace).execute()),
  ]);
  process.stdout.write(`${JSON.stringify(verdict.document())}\n`);
}

await main();
