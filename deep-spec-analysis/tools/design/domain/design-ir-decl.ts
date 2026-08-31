// 契約3 設計 IR の well-formedness 検査材料。スキーマ検証を通過した設計 IR を、
// アダプタの寛容パースが型付きに解体したもの。ユニットごとの BR 材料
// （construction ディレクトリの有無と rules.md 本文）も、探索と読み込みを
// 済ませた形でここに載る——ドメインは I/O を持たない。
//
// 旧 design-ir-valid センサーの semanticErrors が生 Json を走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移った。

import type { AttributeBound, Expression } from "../../kernel/domain/index.ts";
import type { DesignUnitId } from "./design-unit-id.ts";
import type { DesignObligationId, DesignObligationOrigin } from "./design-obligation.ts";
import type { DesignTransitionId } from "./design-transition.ts";
import type { DesignMachineId, DesignEntityName, DesignAttributeName } from "./design-machine.ts";
import type { DesignScenarioId } from "./design-scenario.ts";
import type { DesignBackgroundId } from "./design-unit.ts";

// 型宣言が欠けた属性は kind: "" で届く（旧実装はカタログへ登録した）。
export interface DesignAttributeDecl {
  readonly name: DesignAttributeName;
  readonly kind: string;
  readonly values?: DeclaredValues;
  readonly min?: AttributeBound;
  readonly max?: AttributeBound;
}

export interface DesignEntityDecl {
  readonly name: DesignEntityName;
  readonly attributes: DesignAttributeDecls;
}

export interface DesignTemporalDecl {
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
}

export interface DesignObligationDecl {
  readonly id: DesignObligationId;
  readonly origin?: DesignObligationOrigin;
  // brRefs が配列でなければ undefined（origin:"rules" の必須チェックに使う）。
  readonly brRefs?: BrRefs;
  readonly assert?: Expression;
  readonly guard?: Expression;
  readonly effect?: Expression;
  readonly temporal?: DesignTemporalDecl;
}

export interface DesignTransitionDecl {
  readonly id: DesignTransitionId;
  readonly from?: string;
  readonly to?: string;
  readonly trigger?: string;
  readonly brRefs?: BrRefs;
  readonly guard?: Expression;
  readonly effect?: Expression;
}

export interface DesignIgnoreDecl {
  readonly state: string;
  readonly trigger: string;
}

export interface DesignMachineDecl {
  readonly id: DesignMachineId;
  // `<entity>.<attribute>`。どちらかが文字列でなければ "?" が入る（凍結）。
  readonly attrPath: string;
  readonly initial: InitialStates;
  readonly transitions: DesignTransitionDecls;
  readonly ignores: DesignIgnoreDecls;
}

export interface DesignScenarioDecl {
  readonly id: DesignScenarioId;
  readonly bindings: BindingPairs;
  readonly hasEvent: boolean;
  readonly expect?: Expression;
  readonly brRefs?: BrRefs;
}

export interface DesignBackgroundDecl {
  readonly id: DesignBackgroundId;
  readonly assert?: Expression;
}

export interface DesignUnitDecl {
  readonly unit: DesignUnitId;
  readonly entities: DesignEntityDecls;
  readonly obligations: DesignObligationDecls;
  readonly stateMachines: DesignMachineDecls;
  readonly scenarios: DesignScenarioDecls;
  readonly background: DesignBackgroundDecls;
  readonly unformalizedTargets: UnformalizedTargets;
  // construction/<unit>/ が記録配下に存在するか（記録ルート未解決なら true 扱い
  // ——旧実装は recordRoot === null のときこの検査を出さない）。
  readonly directoryExists: boolean;
  // construction/<unit>/functional-design/rules.md の本文。無ければ null。
  readonly rulesMarkdown: string | null;
}

// ---- ファーストクラスコレクション（decl 束） --------------------------------
// ドメイン層は配列を生で運ばない。巡回・所属・宣言値の照合という集合の知識は
// コレクションが所有し、toArray() は境界専用の脱出口。

export class DeclaredValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): DeclaredValues {
    return new DeclaredValues([...values]);
  }

  add(value: string): DeclaredValues {
    return new DeclaredValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.includes(value);
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

export class BrRefs {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): BrRefs {
    return new BrRefs([...values]);
  }

  add(value: string): BrRefs {
    return new BrRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

export class InitialStates {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): InitialStates {
    return new InitialStates([...values]);
  }

  add(value: string): InitialStates {
    return new InitialStates([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.includes(value);
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

export class UnformalizedTargets {
  readonly #values: ReadonlySet<string>;

  private constructor(values: ReadonlySet<string>) {
    this.#values = values;
  }

  static of(values: readonly string[]): UnformalizedTargets {
    return new UnformalizedTargets(new Set(values));
  }

  add(value: string): UnformalizedTargets {
    return new UnformalizedTargets(new Set([...this.#values, value]));
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  covers(target: string): boolean {
    return this.#values.has(target);
  }

  toArray(): readonly string[] {
    return [...this.#values];
  }
}

export class BindingPairs {
  readonly #values: readonly (readonly [string, unknown])[];

  private constructor(values: readonly (readonly [string, unknown])[]) {
    this.#values = values;
  }

  static of(values: readonly (readonly [string, unknown])[]): BindingPairs {
    return new BindingPairs([...values]);
  }

  add(value: readonly [string, unknown]): BindingPairs {
    return new BindingPairs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<readonly [string, unknown]> {
    yield* this.#values;
  }

  toArray(): readonly (readonly [string, unknown])[] {
    return this.#values;
  }
}

export class DesignAttributeDecls {
  readonly #values: readonly DesignAttributeDecl[];

  private constructor(values: readonly DesignAttributeDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignAttributeDecl[]): DesignAttributeDecls {
    return new DesignAttributeDecls([...values]);
  }

  add(value: DesignAttributeDecl): DesignAttributeDecls {
    return new DesignAttributeDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignAttributeDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignAttributeDecl[] {
    return this.#values;
  }
}

export class DesignEntityDecls {
  readonly #values: readonly DesignEntityDecl[];

  private constructor(values: readonly DesignEntityDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignEntityDecl[]): DesignEntityDecls {
    return new DesignEntityDecls([...values]);
  }

  add(value: DesignEntityDecl): DesignEntityDecls {
    return new DesignEntityDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignEntityDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignEntityDecl[] {
    return this.#values;
  }
}

export class DesignObligationDecls {
  readonly #values: readonly DesignObligationDecl[];

  private constructor(values: readonly DesignObligationDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignObligationDecl[]): DesignObligationDecls {
    return new DesignObligationDecls([...values]);
  }

  add(value: DesignObligationDecl): DesignObligationDecls {
    return new DesignObligationDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignObligationDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignObligationDecl[] {
    return this.#values;
  }
}

export class DesignTransitionDecls {
  readonly #values: readonly DesignTransitionDecl[];

  private constructor(values: readonly DesignTransitionDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignTransitionDecl[]): DesignTransitionDecls {
    return new DesignTransitionDecls([...values]);
  }

  add(value: DesignTransitionDecl): DesignTransitionDecls {
    return new DesignTransitionDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransitionDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignTransitionDecl[] {
    return this.#values;
  }
}

export class DesignIgnoreDecls {
  readonly #values: readonly DesignIgnoreDecl[];

  private constructor(values: readonly DesignIgnoreDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignIgnoreDecl[]): DesignIgnoreDecls {
    return new DesignIgnoreDecls([...values]);
  }

  add(value: DesignIgnoreDecl): DesignIgnoreDecls {
    return new DesignIgnoreDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignIgnoreDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignIgnoreDecl[] {
    return this.#values;
  }
}

export class DesignMachineDecls {
  readonly #values: readonly DesignMachineDecl[];

  private constructor(values: readonly DesignMachineDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignMachineDecl[]): DesignMachineDecls {
    return new DesignMachineDecls([...values]);
  }

  add(value: DesignMachineDecl): DesignMachineDecls {
    return new DesignMachineDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignMachineDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignMachineDecl[] {
    return this.#values;
  }
}

export class DesignScenarioDecls {
  readonly #values: readonly DesignScenarioDecl[];

  private constructor(values: readonly DesignScenarioDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignScenarioDecl[]): DesignScenarioDecls {
    return new DesignScenarioDecls([...values]);
  }

  add(value: DesignScenarioDecl): DesignScenarioDecls {
    return new DesignScenarioDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignScenarioDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignScenarioDecl[] {
    return this.#values;
  }
}

export class DesignBackgroundDecls {
  readonly #values: readonly DesignBackgroundDecl[];

  private constructor(values: readonly DesignBackgroundDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignBackgroundDecl[]): DesignBackgroundDecls {
    return new DesignBackgroundDecls([...values]);
  }

  add(value: DesignBackgroundDecl): DesignBackgroundDecls {
    return new DesignBackgroundDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignBackgroundDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundDecl[] {
    return this.#values;
  }
}

export class DesignUnitDecls {
  readonly #values: readonly DesignUnitDecl[];

  private constructor(values: readonly DesignUnitDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignUnitDecl[]): DesignUnitDecls {
    return new DesignUnitDecls([...values]);
  }

  add(value: DesignUnitDecl): DesignUnitDecls {
    return new DesignUnitDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnitDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignUnitDecl[] {
    return this.#values;
  }
}
