// 設計シナリオ（受け入れ／拒否、BR/FR 両参照つき）。逐語移動。id は
// ドメインプリミティブで運ぶ。




import type { Expression, FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import { type BrRefs } from "./br-refs.ts";
import { DesignScenarioId } from "./design-scenario-id.ts";

export interface DesignScenario {
  id: DesignScenarioId;
  kind: "accept" | "reject";
  brRefs: BrRefs;
  frRefs: FrRefs;
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: TriggerName };
  expect?: Expression;
}

