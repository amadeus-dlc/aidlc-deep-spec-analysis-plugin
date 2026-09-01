// 構造負債走査の対象 1 件——実在する設計成果物と、それを検査する refcheck
// センサー。label は負債行の凍結表示名。
export interface DesignArtifactRef {
  space: string;
  intent: string;
  tool: string;
  artifactPath: string;
  label: string;
}
