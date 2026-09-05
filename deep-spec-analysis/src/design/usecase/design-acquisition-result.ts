// DesignVerificationAcquirer.acquire の返却契約（usecase 内部型）。ready は
// 共通境界の終端で、ここから先は各 backend が solver／probe／refinement へ進む。
// terminal はそのまま呼出側の VerifyDesignOutcome になる。

import type { DesignModel } from "@deep-spec/design-domain";
import type { ContentHash } from "@deep-spec/kernel-domain";
import type { DesignAcquisitionTerminal } from "./design-acquisition-terminal.ts";

export type DesignAcquisitionResult =
  | { readonly kind: "ready"; readonly model: DesignModel; readonly irHash: ContentHash }
  | { readonly kind: "terminal"; readonly outcome: DesignAcquisitionTerminal };
