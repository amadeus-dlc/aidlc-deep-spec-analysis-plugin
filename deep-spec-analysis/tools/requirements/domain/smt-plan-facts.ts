// SMT 検証計画の「事実」——判定解釈に必要な、形式（SMT-LIB）を含まない面。
// クエリ id（"global" / "vac:OB-x" / "evo:a:b" / "evj:a:b" / "gap:trigger" /
// "sc:SC-x"）とラベル→対象の対応、コンパイル時 skip がここに載る。
// スクリプト本体はアダプタの計画ビルダが所有する。

import type { VerificationSkips } from "./verification-finding.ts";

export interface SmtEventPairProbe {
  readonly qOverlap: string;
  readonly qJoint: string;
  readonly a: string;
  readonly b: string;
  readonly trigger: string;
}

export interface SmtPlanFacts {
  readonly compiled: ReadonlyMap<string, boolean>;
  readonly skipped: VerificationSkips;
  readonly labelToTarget: ReadonlyMap<string, string>;
  readonly eventPairs: readonly SmtEventPairProbe[];
  readonly gapTriggers: ReadonlyMap<string, readonly string[]>;
  readonly scenarioQueries: ReadonlyMap<string, string>;
}
