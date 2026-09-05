// components.md の型付き入力モデル（domain 語彙）。
// 解析（YAML/fence 歩き）はアダプタのパーサが行い、ここは検査が消費する形。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクションで
// 運ぶ。DD-1 の重複検出・DD-5 の所有競合・DD-7 の閉路検出は集まり＝
// Components の知識。

import { type ArtifactPath, FindingKind, TargetIdentifiers } from "@deep-spec/kernel-domain";
import type { Component } from "./component.ts";
import { DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7 } from "./component-check-families.ts";
import type { ComponentEntity } from "./component-entity.ts";
import { ComponentName } from "./component-name.ts";
import { EntityName } from "./entity-name.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// 宣言済みコンポーネントの集まり——名前解決・依存グラフの知識を持つ。
export class Components {
  readonly #values: readonly Component[];

  private constructor(values: readonly Component[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly Component[]): Components {
    return new Components(values);
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
      .map(([name, list]) => ({ name: EntityName.of(name), owners: list }));
  }

  // Deterministic cycle detection over the depends_on graph. Returns each
  // distinct cycle once, canonicalized to start at its lexicographically
  // smallest member.（旧 findCycles の逐語移設——グラフは Components の知識）
  dependencyCycles(): string[][] {
    const declared = new Set(this.#values.map((c) => c.name().asString()));
    const adj = new Map<string, string[]>();
    for (const c of [...this.#values].sort((a, b) => (a.name().asString() < b.name().asString() ? -1 : 1))) {
      const deps = c
        .dependsOn()
        .toArray()
        .map((d) => d.component())
        .filter((n) => declared.has(n.asString()))
        .sort((a, b) => a.compareTo(b));
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

  // DD-1..DD-7 の不変条件（種別規律の裁定 11）。判定は宣言と集まりの知識、
  // 文言と発生順は golden 凍結。
  check(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const art = artifact.asString();

    // --- DD-1: name uniqueness + PascalCase -------------------------------
    for (const c of this) {
      if (!c.nameIsPascalCase()) {
        const cName = c.name().asString();
        report.finding(
          DD_1,
          FindingKind.structureInvalid(),
          [TargetIdentifiers.safe("component", cName)],
          [WitnessReference.at(art, `${c.element().asString()}.name`, cName)],
          `component name "${cName}" is not PascalCase`,
        );
      }
    }
    for (const { prior, current } of this.duplicateNamePairs()) {
      const cName = current.name().asString();
      report.finding(
        DD_1,
        FindingKind.structureInvalid(),
        [TargetIdentifiers.safe("component", cName)],
        [
          WitnessReference.at(art, `${prior.element().asString()}.name`, cName),
          WitnessReference.at(art, `${current.element().asString()}.name`, cName),
        ],
        `component name "${cName}" is declared more than once`,
      );
    }

    // --- DD-2: referenced components declared -----------------------------
    for (const c of this) {
      for (const r of [...c.dependsOn(), ...c.dependents()]) {
        if (!this.declares(r.component())) {
          report.finding(
            DD_2,
            FindingKind.referenceBroken(),
            [TargetIdentifiers.safe("component", r.component().asString())],
            [WitnessReference.at(art, r.element().asString(), r.component().asString())],
            `"${c.name().asString()}" references undeclared component "${r.component().asString()}"`,
          );
        }
      }
      for (const e of c.entities()) {
        for (const r of e.references()) {
          if (!this.declares(r.ownedBy())) {
            report.finding(
              DD_2,
              FindingKind.referenceBroken(),
              [TargetIdentifiers.safe("component", r.ownedBy().asString())],
              [WitnessReference.at(art, `${r.element().asString()}.owned_by`, r.ownedBy().asString())],
              `entity "${e.name().asString()}" references owner component "${r.ownedBy().asString()}" which is not declared`,
            );
          }
        }
      }
    }

    // --- DD-3: no self-dependency ------------------------------------------
    for (const c of this) {
      for (const r of c.selfReferences()) {
        report.finding(
          DD_3,
          FindingKind.structureInvalid(),
          [TargetIdentifiers.safe("component", c.name().asString())],
          [WitnessReference.at(art, r.element().asString(), c.name().asString())],
          `component "${c.name().asString()}" lists itself as a dependency`,
        );
      }
    }

    // --- DD-4: depends_on / dependents symmetry ----------------------------
    for (const c of this) {
      for (const r of c.dependsOn()) {
        const other = this.byName(r.component());
        if (!other || r.pointsAt(c.name())) continue;
        if (!other.dependents().listsComponent(c.name())) {
          report.finding(
            DD_4,
            FindingKind.structureInvalid(),
            [
              TargetIdentifiers.safe("component", c.name().asString()),
              TargetIdentifiers.safe("component", r.component().asString()),
            ],
            [
              WitnessReference.at(art, r.element().asString(), r.component().asString()),
              WitnessReference.at(art, `${other.element().asString()}.dependents`, c.name().asString()),
            ],
            `"${c.name().asString()}" depends on "${r.component().asString()}" but "${r.component().asString()}" does not list "${c.name().asString()}" in dependents`,
          );
        }
      }
      for (const r of c.dependents()) {
        const other = this.byName(r.component());
        if (!other || r.pointsAt(c.name())) continue;
        if (!other.dependsOn().listsComponent(c.name())) {
          report.finding(
            DD_4,
            FindingKind.structureInvalid(),
            [
              TargetIdentifiers.safe("component", c.name().asString()),
              TargetIdentifiers.safe("component", r.component().asString()),
            ],
            [
              WitnessReference.at(art, r.element().asString(), r.component().asString()),
              WitnessReference.at(art, `${other.element().asString()}.depends_on`, c.name().asString()),
            ],
            `"${c.name().asString()}" lists "${r.component().asString()}" as a dependent but "${r.component().asString()}" does not depend on "${c.name().asString()}"`,
          );
        }
      }
    }

    // --- DD-5: entity single ownership + identifier ------------------------
    for (const c of this) {
      for (const e of c.entities()) {
        if (!e.hasIdentifier()) {
          report.finding(
            DD_5,
            FindingKind.structureInvalid(),
            [TargetIdentifiers.safe("entity", e.name().asString())],
            [WitnessReference.at(art, `${e.element().asString()}.identifier`)],
            `entity "${e.name().asString()}" has no identifier`,
          );
        }
      }
    }
    for (const conflict of this.ownershipConflicts()) {
      const name = conflict.name.asString();
      report.finding(
        DD_5,
        FindingKind.structureInvalid(),
        [TargetIdentifiers.safe("entity", name)],
        conflict.owners.map((o) =>
          WitnessReference.at(art, o.entity.element().asString(), o.component.name().asString()),
        ),
        `entity "${name}" is owned by ${conflict.owners.length} components (${conflict.owners.map((o) => o.component.name().asString()).join(", ")}) — must be exactly one`,
      );
    }

    // --- DD-6: references.entity declared under its owned_by ---------------
    for (const c of this) {
      for (const e of c.entities()) {
        for (const r of e.references()) {
          const owner = this.byName(r.ownedBy());
          if (!owner) continue; // DD-2 already reported the undeclared owner
          if (!owner.entities().declaresEntity(r.entity())) {
            report.finding(
              DD_6,
              FindingKind.referenceBroken(),
              [TargetIdentifiers.safe("entity", r.entity().asString())],
              [WitnessReference.at(art, `${r.element().asString()}.entity`, r.entity().asString())],
              `entity "${e.name().asString()}" references "${r.entity().asString()}" as owned by "${r.ownedBy().asString()}", but "${r.ownedBy().asString()}" declares no such entity`,
            );
          }
        }
      }
    }

    // --- DD-7: acyclic depends_on graph -------------------------------------
    // Self-loops are DD-3's finding; DD-7 reports only genuine multi-node cycles.
    for (const cycle of this.dependencyCycles().filter((c) => c.length > 1)) {
      report.finding(
        DD_7,
        FindingKind.structureInvalid(),
        cycle.map((n) => TargetIdentifiers.safe("component", n)),
        cycle.map((n, i) =>
          WitnessReference.at(
            art,
            `${this.byName(ComponentName.of(n))?.element().asString() ?? "components"}.depends_on`,
            cycle[(i + 1) % cycle.length],
          ),
        ),
        `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`,
      );
    }
  }
}
