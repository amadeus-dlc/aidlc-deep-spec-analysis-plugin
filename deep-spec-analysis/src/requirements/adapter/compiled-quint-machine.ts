import { QuintMachinePlan } from "@deep-spec/requirements-domain";
import type { VerificationSkipped } from "@deep-spec/requirements-domain";

// コンパイル済み機械 — モジュール本文・変数名対応・シナリオ init の action 名は
// 形式知識としてアダプタ内に留め、plan だけがドメインへ渡る。
export interface CompiledQuintMachine {
  moduleText: string;
  plan: QuintMachinePlan;
  compileSkips: VerificationSkipped[];
  varToPath: Map<string, string>;
  scenarioInitActions: Map<string, string>;
  temporalNames: Map<string, string>;
}
