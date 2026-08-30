// components.md の型付き入力モデル（domain 語彙）。
// 解析（YAML/fence 歩き）はアダプタのパーサが行い、ここは検査が消費する形。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクションで
// 運ぶ。DD-7 の閉路検出は依存グラフ＝Components の知識。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { AttributeName, ComponentName, ElementPath, EntityName } from "./functional-design-values.ts";

export interface ComponentRef {
  readonly component: ComponentName;
  readonly element: ElementPath;
}

// 依存参照（depends_on / dependents）のファーストクラスコレクション。
export class ComponentRefs {
  readonly #values: readonly ComponentRef[];

  private constructor(values: readonly ComponentRef[]) {
    this.#values = values;
  }

  static of(values: readonly ComponentRef[]): ComponentRefs {
    return new ComponentRefs([...values]);
  }

  add(value: ComponentRef): ComponentRefs {
    return new ComponentRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentRef> {
    yield* this.#values;
  }

  // DD-4 の対称性検査：この参照面が name を挙げているか。
  listsComponent(name: ComponentName): boolean {
    return this.#values.some((r) => r.component.equals(name));
  }

  toArray(): readonly ComponentRef[] {
    return this.#values;
  }
}

export interface EntityReference {
  readonly entity: EntityName;
  readonly ownedBy: ComponentName;
  readonly element: ElementPath;
}

export class EntityReferences {
  readonly #values: readonly EntityReference[];

  private constructor(values: readonly EntityReference[]) {
    this.#values = values;
  }

  static of(values: readonly EntityReference[]): EntityReferences {
    return new EntityReferences([...values]);
  }

  add(value: EntityReference): EntityReferences {
    return new EntityReferences([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EntityReference> {
    yield* this.#values;
  }

  toArray(): readonly EntityReference[] {
    return this.#values;
  }
}

export interface ComponentEntity {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly identifier: AttributeName | null;
  readonly references: EntityReferences;
}

export class ComponentEntities {
  readonly #values: readonly ComponentEntity[];

  private constructor(values: readonly ComponentEntity[]) {
    this.#values = values;
  }

  static of(values: readonly ComponentEntity[]): ComponentEntities {
    return new ComponentEntities([...values]);
  }

  add(value: ComponentEntity): ComponentEntities {
    return new ComponentEntities([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentEntity> {
    yield* this.#values;
  }

  // DD-6：owner がこの名前のエンティティを宣言しているか。
  declaresEntity(name: EntityName): boolean {
    return this.#values.some((e) => e.name.equals(name));
  }

  toArray(): readonly ComponentEntity[] {
    return this.#values;
  }
}

export interface Component {
  readonly name: ComponentName;
  readonly element: ElementPath;
  readonly dependsOn: ComponentRefs;
  readonly dependents: ComponentRefs;
  readonly entities: ComponentEntities;
}

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
        sortedUnique(
          c.dependsOn.toArray().map((d) => d.component.asString()).filter((n) => declared.has(n)),
          idCompare,
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

export interface ComponentShapeError {
  readonly element: ElementPath;
  readonly detail: string;
}

export class ComponentShapeErrors {
  readonly #values: readonly ComponentShapeError[];

  private constructor(values: readonly ComponentShapeError[]) {
    this.#values = values;
  }

  static of(values: readonly ComponentShapeError[]): ComponentShapeErrors {
    return new ComponentShapeErrors([...values]);
  }

  add(value: ComponentShapeError): ComponentShapeErrors {
    return new ComponentShapeErrors([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentShapeError> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly ComponentShapeError[] {
    return this.#values;
  }
}

// アダプタのパーサが返す解析結果（DD-0 の判定材料まで型で運ぶ）。
// エラー分岐（wrong-fence-count / unparseable）は材料のみの閉じたユニオン。
export type ComponentCatalogOutcome =
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly components: Components; readonly shapeErrors: ComponentShapeErrors };
