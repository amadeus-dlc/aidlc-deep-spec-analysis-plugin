// エンティティ属性ひとつを生涯とする状態機械（契約3）。deterministic: false は
// 同一 (state, trigger) 重複の人間承認済み waiver 宣言。逐語移動。id と
// 生涯属性の座標（entity / attribute）はドメインプリミティブで運ぶ。






import { type DesignTransitions } from "./design-transitions.ts";
import { type InitialStates } from "./initial-states.ts";
import { DesignAttributeName } from "./design-attribute-name.ts";
import { DesignEntityName } from "./design-entity-name.ts";
import { DesignIgnores } from "./design-ignores.ts";
import { DesignMachineId } from "./design-machine-id.ts";



export interface DesignMachine {
  id: DesignMachineId;
  entity: DesignEntityName;
  attribute: DesignAttributeName;
  initial: InitialStates;
  transitions: DesignTransitions;
  ignores: DesignIgnores;
  deterministic: boolean;
}

