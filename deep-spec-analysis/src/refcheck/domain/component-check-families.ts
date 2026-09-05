// components.md の検査ファミリー（DD-0..DD-7）。レポートを開く面
// （COMPONENT_FAMILIES）と、各判定が finding／skip を書くときの family。
// 値は CheckFamily で、描画（`DD-1: …`／`check:DD-1`）は family の知識。

import { CheckFamilies } from "./check-families.ts";
import { CheckFamily } from "./check-family.ts";

export const DD_0 = CheckFamily.of("DD-0");
export const DD_1 = CheckFamily.of("DD-1");
export const DD_2 = CheckFamily.of("DD-2");
export const DD_3 = CheckFamily.of("DD-3");
export const DD_4 = CheckFamily.of("DD-4");
export const DD_5 = CheckFamily.of("DD-5");
export const DD_6 = CheckFamily.of("DD-6");
export const DD_7 = CheckFamily.of("DD-7");

export const COMPONENT_FAMILIES = CheckFamilies.of([DD_0, DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7]);
