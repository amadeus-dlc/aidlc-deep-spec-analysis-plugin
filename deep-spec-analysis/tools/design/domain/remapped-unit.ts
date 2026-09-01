// remap — lowered v1 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す。
// lowered id は設計向けテキストへ決して漏れない：v1 detail 内の OB-n 参照は
// 設計 id へ書き換える（"DOB-2" は \bOB-2\b 境界を含まないため二重書き換えは
// 起きない）。vac-dead は unreachable へ、vac-shadow は redundancy へ変換し、
// 相互包摂（両方向証明）は 1 件の「等価」finding へ畳む。deterministic: false
// を宣言した機械の同 (state,trigger) 重複 conflict は waived skip へ（人間承認
// 済みのモデル waiver——沈黙ではない）。文言はすべて golden 凍結。
// 旧 deep-spec-design-lib.ts の remapUnitDocument は LoweredUnit#remapVerdicts
// になった（OOUI 裁定）——ここは判定面の型とコレクションだけを持つ。

import { type DesignFindings } from "./design-findings.ts";
import { type DesignSkips } from "./design-skips.ts";

export interface RemappedUnit {
  readonly findings: DesignFindings;
  readonly skipped: DesignSkips;
  unavailable: string | null;
  method: string | null;
}

