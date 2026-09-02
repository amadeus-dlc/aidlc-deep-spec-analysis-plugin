// contract-summary.md の検査ファミリー（CD-1..CD-3）。レポートを開く面
// （CONTRACT_FAMILIES）と、各判定が finding／skip を書くときの family。

import { CheckFamily } from "./check-family.ts";
import { CheckFamilies } from "./check-families.ts";

export const CD_1 = CheckFamily.reconstitute("CD-1");
export const CD_2 = CheckFamily.reconstitute("CD-2");
export const CD_3 = CheckFamily.reconstitute("CD-3");

export const CONTRACT_FAMILIES = CheckFamilies.of([CD_1, CD_2, CD_3]);
