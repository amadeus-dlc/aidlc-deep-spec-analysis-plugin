// 取得境界が返せる terminal outcome。VerifyDesignOutcome を Extract で 5 変種へ
// 狭めた usecase 内部型で、外部へ露出しない（新しいドメインオブジェクトでは
// ない）。成功（verified）と backend 固有の outcome（backend-unavailable）は
// この集合に入らない——それらは各 backend の usecase だけが返す（BR5.1／BR5.2）。

import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";

export type DesignAcquisitionTerminal = Extract<
  VerifyDesignOutcome,
  { kind: "not-applicable" | "acquisition-failed" | "model-unreadable" | "version-mismatch" | "save-failed" }
>;
