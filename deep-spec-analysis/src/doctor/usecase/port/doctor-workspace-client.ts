import type { CoverageAssessment, DesignArtifacts, UnitCoverage } from "@deep-spec/doctor-domain";

// 取得adapterが保存状態を観測型へ再構成する。査定は返したドメインが所有する。
export interface DoctorWorkspaceClient {
  verificationCoverage(): CoverageAssessment;
  functionalCoverage(): UnitCoverage;
  designArtifacts(): DesignArtifacts;
}
