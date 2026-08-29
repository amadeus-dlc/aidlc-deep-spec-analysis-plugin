// refcheck finding（契約2 語彙）。deep-spec-lib.ts からの逐語移動。
// キー順（= golden バイト）は現状センサーの構築サイトが持つため、VO 化
//（キー順を型が所有する render）は構築サイトを作り替える PR2b で行う。

import type { RefEntry } from "./ref-entry.ts";

export interface Finding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: { refs: RefEntry[] };
  unit?: string;
  detail: string;
}
