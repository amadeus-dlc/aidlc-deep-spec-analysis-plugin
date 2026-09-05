// functional-design の検査ファミリー（FD-E／FD-R／FD-S／XS）。レポートを
// 開く面（FUNCTIONAL_FAMILIES——checked の並びの材料、宣言順は凍結）と、各
// 判定が finding／skip を書くときの family。

import { CheckFamilies } from "./check-families.ts";
import { CheckFamily } from "./check-family.ts";

export const FD_E1 = CheckFamily.of("FD-E1");
export const FD_E2 = CheckFamily.of("FD-E2");
export const FD_E3 = CheckFamily.of("FD-E3");
export const FD_E4 = CheckFamily.of("FD-E4");
export const FD_E5 = CheckFamily.of("FD-E5");
export const FD_E6 = CheckFamily.of("FD-E6");
export const FD_R1 = CheckFamily.of("FD-R1");
export const FD_R2 = CheckFamily.of("FD-R2");
export const FD_R3 = CheckFamily.of("FD-R3");
export const FD_R4 = CheckFamily.of("FD-R4");
export const FD_R5 = CheckFamily.of("FD-R5");
export const FD_S1 = CheckFamily.of("FD-S1");
export const FD_S2 = CheckFamily.of("FD-S2");
export const XS_1 = CheckFamily.of("XS-1");
export const XS_2 = CheckFamily.of("XS-2");
export const XS_3 = CheckFamily.of("XS-3");

export const FUNCTIONAL_FAMILIES = CheckFamilies.of([
  FD_E1,
  FD_E2,
  FD_E3,
  FD_E4,
  FD_E5,
  FD_E6,
  FD_R1,
  FD_R2,
  FD_R3,
  FD_R4,
  FD_R5,
  FD_S1,
  FD_S2,
  XS_1,
  XS_2,
  XS_3,
]);
