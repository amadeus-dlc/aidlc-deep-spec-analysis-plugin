import { QuintMachineFacts } from "../domain/index.ts";
import type { VerificationSkipped } from "../domain/index.ts";

// コンパイル済み機械 — モジュール本文・変数名対応・シナリオ init の action 名は
// 形式知識としてアダプタ内に留め、facts だけがドメインへ渡る。
export interface CompiledQuintMachine {
  moduleText: string;
  facts: QuintMachineFacts;
  compileSkips: VerificationSkipped[];
  varToPath: Map<string, string>;
  scenarioInitActions: Map<string, string>;
  temporalNames: Map<string, string>;
}
