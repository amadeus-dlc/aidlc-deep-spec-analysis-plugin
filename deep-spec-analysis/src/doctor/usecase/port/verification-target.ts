import type { DigestAnchor } from "@deep-spec/doctor-domain";

// 要件検証カバレッジの走査材料 1 件——スコープ適格で requirements.md を持つ
// intent（＝適格母数）。鮮度判断の材料（anchor 対）はゲートウェイが読み、
// 判断そのものは domain（VerificationStaleness）が下す。
export interface VerificationTarget {
  space: string;
  intent: string;
  hasModel: boolean;
  hasFindings: boolean;
  anchor: DigestAnchor | null;
}
