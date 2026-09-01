// components.md の型付き入力モデル（domain 語彙）。
// 解析（YAML/fence 歩き）はアダプタのパーサが行い、ここは検査が消費する形。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクションで
// 運ぶ。DD-7 の閉路検出は依存グラフ＝Components の知識。

import { IdOrder } from "../../kernel/domain/index.ts";
import { type ComponentName } from "./component-name.ts";
import type { Component } from "./component.ts";

// 宣言済みコンポーネントの集まり——名前解決・依存グラフの知識を持つ。
export class Components {
  readonly #values: readonly Component[];

  private constructor(values: readonly Component[]) {
    this.#values = values;
  }

  static of(values: readonly Component[]): Components {
    return new Components([...values]);
  }

  add(value: Component): Components {
    return new Components([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Component> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  declares(name: ComponentName): boolean {
    return this.#values.some((c) => c.name.equals(name));
  }

  // 重複名は最後の宣言が勝つ——旧実装の name→Component Map（Map.set の
  // 上書き）の凍結挙動。重複自体は DD-1 の finding だが、後続検査
  // （DD-4/DD-6/DD-7 の witness）は最後の宣言へ束縛される。
  byName(name: ComponentName): Component | null {
    let found: Component | null = null;
    for (const c of this.#values) {
      if (c.name.equals(name)) found = c;
    }
    return found;
  }

  // Deterministic cycle detection over the depends_on graph. Returns each
  // distinct cycle once, canonicalized to start at its lexicographically
  // smallest member.（旧 findCycles の逐語移設——グラフは Components の知識）
  dependencyCycles(): string[][] {
    const declared = new Set(this.#values.map((c) => c.name.asString()));
    const adj = new Map<string, string[]>();
    for (const c of [...this.#values].sort((a, b) => (a.name.asString() < b.name.asString() ? -1 : 1))) {
      adj.set(
        c.name.asString(),
        IdOrder.sortedUnique(
          c.dependsOn.toArray().map((d) => d.component.asString()).filter((n) => declared.has(n)),
          IdOrder.compare,
        ),
      );
    }
    const cycles = new Map<string, string[]>();
    const state = new Map<string, "active" | "done">();
    const stack: string[] = [];
    const visit = (node: string): void => {
      state.set(node, "active");
      stack.push(node);
      for (const next of adj.get(node) ?? []) {
        const s = state.get(next);
        if (s === "done") continue;
        if (s === "active") {
          const from = stack.indexOf(next);
          const cycle = stack.slice(from);
          let minIdx = 0;
          cycle.forEach((n, i) => {
            if (n < (cycle[minIdx] ?? "")) minIdx = i;
          });
          const canonical = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
          cycles.set(canonical.join("->"), canonical);
          continue;
        }
        visit(next);
      }
      stack.pop();
      state.set(node, "done");
    };
    for (const name of [...adj.keys()]) {
      if (!state.has(name)) visit(name);
    }
    return [...cycles.keys()].sort().map((k) => cycles.get(k) as string[]);
  }

  toArray(): readonly Component[] {
    return this.#values;
  }
}

