import { AttributePath, BindingValue, ScenarioBinding, ScenarioBindings } from "@deep-spec/kernel-domain";

// テスト文書からの構築。製品の公開APIには生のマップを受ける互換口を置かない。
export function scenarioBindings(values: Readonly<Record<string, boolean | number | string>>): ScenarioBindings {
  return ScenarioBindings.of(
    Object.entries(values).map(([path, value]) => ScenarioBinding.of(AttributePath.of(path), BindingValue.of(value))),
  );
}
