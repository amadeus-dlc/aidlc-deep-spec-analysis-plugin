import type { CoverageAssessment, DesignArtifacts, UnitCoverage } from "@deep-spec-analysis/doctor-domain";
import type { Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

// 取得adapterが保存状態を観測型へ再構成する。査定は返したドメインが所有する。
export interface DoctorWorkspaceClient {
  verificationCoverage(): Result<CoverageAssessment, RepositoryError>;
  functionalCoverage(): Result<UnitCoverage, RepositoryError>;
  designArtifacts(): Result<DesignArtifacts, RepositoryError>;
}
