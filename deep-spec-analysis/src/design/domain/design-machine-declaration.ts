import { type EnumerationMembers, ErrorMessage, ErrorMessages } from "@deep-spec-analysis/kernel-domain";

import type { DesignAttributeCatalog } from "./design-attribute-catalog.ts";

import type { DesignIgnoreDeclarations } from "./design-ignore-declarations.ts";
import type { DesignMachineIdentifier } from "./design-machine-identifier.ts";
import type { DesignTransitionDeclarations } from "./design-transition-declarations.ts";
import type { InitialStates } from "./initial-states.ts";
import { sameIterable } from "./value-equality.ts";

// 契約3 設計 IR の状態機械宣言（well-formedness 検査材料）。初期状態のうち
// 状態集合に属さないものの選別は宣言自身の知識（#71 波13）。attrPath は
// `<entity>.<attribute>` の結合形（裁定の恒久除外）——どちらかが文字列で
// なければ "?" が入る（凍結）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignMachineDeclarationParam = {
  id: DesignMachineIdentifier;
  attrPath: string;
  initial: InitialStates;
  transitions: DesignTransitionDeclarations;
  ignores: DesignIgnoreDeclarations;
};

export class DesignMachineDeclaration {
  readonly #id: DesignMachineIdentifier;
  readonly #attrPath: string;
  readonly #initial: InitialStates;
  readonly #transitions: DesignTransitionDeclarations;
  readonly #ignores: DesignIgnoreDeclarations;

  private constructor(props: DesignMachineDeclarationParam) {
    this.#id = props.id;
    this.#attrPath = props.attrPath;
    this.#initial = props.initial;
    this.#transitions = props.transitions;
    this.#ignores = props.ignores;
  }

  static of(props: DesignMachineDeclarationParam): DesignMachineDeclaration {
    return new DesignMachineDeclaration(props);
  }

  equals(other: DesignMachineDeclaration): boolean {
    return (
      this.#id.equals(other.#id) &&
      this.#attrPath === other.#attrPath &&
      sameIterable(this.#initial, other.#initial, (left, right) => left.equals(right)) &&
      sameIterable(this.#transitions, other.#transitions, (left, right) => left.equals(right)) &&
      sameIterable(this.#ignores, other.#ignores, (left, right) => left.equals(right))
    );
  }

  id(): DesignMachineIdentifier {
    return this.#id;
  }

  attrPath(): string {
    return this.#attrPath;
  }

  initial(): InitialStates {
    return this.#initial;
  }

  transitions(): DesignTransitionDeclarations {
    return this.#transitions;
  }

  ignores(): DesignIgnoreDeclarations {
    return this.#ignores;
  }

  diagnostics(catalog: DesignAttributeCatalog): ErrorMessages {
    const errors: string[] = [];
    const ctx = `machine ${this.#id.asString()}`;
    const attrPath = this.attrPath();
    const attr = catalog.declares(attrPath);
    if (!attr) {
      errors.push(`${ctx}: lifecycle attribute "${attrPath}" is not declared`);
      return ErrorMessages.collect(errors.map(ErrorMessage.parse));
    }
    const states = catalog.enumValuesAt(attrPath);
    if (states === null) {
      errors.push(`${ctx}: lifecycle attribute "${attrPath}" is not an enum — its values are the state set`);
      return ErrorMessages.collect(errors.map(ErrorMessage.parse));
    }
    for (const s of this.initialStatesOutside(states)) {
      errors.push(`${ctx}: initial state "${s}" is not a value of ${attrPath}`);
    }
    const transitionCells = new Set<string>();
    for (const tr of this.transitions()) {
      const tctx = `transition ${tr.id().asString()}`;
      for (const [k, v] of tr.stateEntries()) {
        if (v !== undefined && !states.exists((state) => state.matchesLiteral(v))) {
          errors.push(`${tctx}: ${k} state "${v}" is not a value of ${attrPath}`);
        }
      }
      const cellKey = tr.cellKey();
      if (cellKey !== null) transitionCells.add(cellKey);
      tr.inspectExpressions((expression, primesAllowed) => {
        for (const message of catalog.expressionDiagnostics(expression, tctx, primesAllowed))
          errors.push(message.asString());
      });
      if (tr.assignsPrimedReferenceTo(attrPath)) {
        errors.push(`${tctx}: the effect assigns the machine's own attribute "${attrPath}" — state' = to is implicit`);
      }
    }
    for (const ig of this.ignores()) {
      if (!ig.isStateAmong(states)) {
        errors.push(`${ctx}: ignores state "${ig.state()}" is not a value of ${attrPath}`);
      }
      if (transitionCells.has(ig.cellKey())) {
        errors.push(
          `${ctx}: ignores (${ig.state()}, ${ig.trigger().asString()}) collides with a declared transition for the same (state, trigger)`,
        );
      }
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  // 初期状態のうち状態集合に属さないもの（宣言順——文言の発生順を決める凍結面）。
  initialStatesOutside(states: EnumerationMembers): string[] {
    return [...this.#initial]
      .filter((state) => !states.exists((declared) => declared.matchesLiteral(state.asString())))
      .map((state) => state.asString());
  }
}
