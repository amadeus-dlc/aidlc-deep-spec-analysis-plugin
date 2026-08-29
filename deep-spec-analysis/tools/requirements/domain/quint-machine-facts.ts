// Quint 状態機械の「事実」——判定解釈に必要な、形式（Quint テキスト）を
// 含まない面。不変量成分（帰属評価に使う式つき）・イベント義務 id・
// 全属性が束縛された init 可能シナリオの集合がここに載る。
// モジュール本文と変数名対応はアダプタのコンパイラが所有する。

import type { Expression } from "./expression.ts";

export interface QuintMachineComponent {
  readonly id: string;
  readonly expr: Expression;
  readonly frRefs: readonly string[];
}

export interface QuintMachineFacts {
  readonly invariantComponents: readonly QuintMachineComponent[];
  readonly eventIds: readonly string[];
  readonly scenariosWithInit: ReadonlySet<string>;
}
