// components.md の型付き入力モデル（domain 語彙）。
// 解析（YAML/fence 歩き）はアダプタのパーサが行い、ここは検査が消費する形。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクションで
// 運ぶ。DD-1 の重複検出・DD-5 の所有競合・DD-7 の閉路検出は集まり＝
// Components の知識。

import { type ComponentName } from "./component-name.ts";
import type { Component } from "./component.ts";
import { type ComponentEntity } from "./component-entity.ts";
import { EntityName } from "./entity-name.ts";

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
    return this.#values.some((c) => c.name().equals(name));
  }

  // DD-1: 同名で再宣言されたコンポーネント——直前の宣言との対（宣言順、
  // 旧 seen-map 走査の凍結列。3 度目以降は直前の重複と対になる）。
  duplicateNamePairs(): { prior: Component; current: Component }[] {
    const seen = new Map<string, Component>();
    const pairs: { prior: Component; current: Component }[] = [];
    for (const c of this.#values) {
      const prior = seen.get(c.name().asString());
      if (prior) pairs.push({ prior, current: c });
      seen.set(c.name().asString(), c);
    }
    return pairs;
  }

  // 重複名は最後の宣言が勝つ——旧実装の name→Component Map（Map.set の
  // 上書き）の凍結挙動。重複自体は DD-1 の finding だが、後続検査
  // （DD-4/DD-6/DD-7 の witness）は最後の宣言へ束縛される。
  byName(name: ComponentName): Component | null {
    let found: Component | null = null;
    for (const c of this.#values) {
      if (c.name().equals(name)) found = c;
    }
    return found;
  }

  // DD-5: 複数のコンポーネントに所有されるエンティティ（エンティティ名昇順、
  // 所有側は宣言順——旧 owners-map 走査の凍結列）。
  ownershipConflicts(): { name: EntityName; owners: { component: Component; entity: ComponentEntity }[] }[] {
    const owners = new Map<string, { component: Component; entity: ComponentEntity }[]>();
    for (const c of this.#values) {
      for (const e of c.entities()) {
        const list = owners.get(e.name().asString()) ?? [];
        list.push({ component: c, entity: e });
        owners.set(e.name().asString(), list);
      }
    }
    return [...owners.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .filter(([, list]) => list.length > 1)
      .map(([name, list]) => ({ name: EntityName.reconstitute(name), owners: list }));
  }

  // Deterministic cycle detection over the depends_on graph. Returns each
  // distinct cycle once, canonicalized to start at its lexicographically
  // smallest member.（旧 findCycles の逐語移設——グラフは Components の知識）
  dependencyCycles(): string[][] {
    const declared = new Set(this.#values.map((c) => c.name().asString()));
    const adj = new Map<string, string[]>();
    for (const c of [...this.#values].sort((a, b) => (a.name().asString() < b.name().asString() ? -1 : 1))) {
      const deps = c.dependsOn().toArray().map((d) => d.component()).filter((n) => declared.has(n.asString())).sort((a, b) => a.compareTo(b));
      const names: string[] = [];
      for (const n of deps) if (!names.includes(n.asString())) names.push(n.asString());
      adj.set(c.name().asString(), names);
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

