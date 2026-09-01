// 受け入れ／拒否シナリオ。逐語移動。id はドメインプリミティブで運ぶ。




import type { Expression } from "../../kernel/domain/expression.ts";
import type { FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import { ScenarioId } from "./scenario-id.ts";

export interface Scenario {
  id: ScenarioId;
  kind: "accept" | "reject";
  frRefs: FrRefs;
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: TriggerName };
  expect?: Expression;
}

