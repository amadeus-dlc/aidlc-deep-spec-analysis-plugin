// 契約1 IR の well-formedness 検査材料。スキーマ検証を通過した IR を、
// アダプタの寛容パースが型付きに解体したもの——「Json をどう読むか」は
// アダプタの知識で、ここには構造だけが残る。束はファーストクラス
// コレクションで運び、意味的整合性（旧 modelWellFormednessErrors——一意な
// id、解決可能な属性参照、enum リテラルの所属、prime の合法性）は
// IrModelDecl 自身の振る舞い（OOUI 裁定）。エラー文言と発生順序は ir-valid
// の errors[] としてそのまま観測面に出る凍結面。
//
// 旧 ir-valid センサーのローカル semanticErrors が生 Json を直接走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移り、ここに来る
// 時点で型は確定している。

import { type Expression, walkExpression } from "../../kernel/domain/index.ts";

// enum 属性の宣言値のコレクション（宣言順を保持——序数対応・文言順に効く）。
export class IrDeclaredValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): IrDeclaredValues {
    return new IrDeclaredValues([...values]);
  }

  add(value: string): IrDeclaredValues {
    return new IrDeclaredValues([...this.#values, value]);
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

// 型宣言が欠けた属性は kind: "" として届く（旧実装は type 欠落でも属性を
// カタログへ登録した——参照解決の可否がそれで変わるため保存する）。
export interface IrAttributeDecl {
  readonly name: string;
  readonly kind: string;
  readonly values?: IrDeclaredValues;
  readonly min?: number;
  readonly max?: number;
}

export class IrAttributeDecls {
  readonly #values: readonly IrAttributeDecl[];

  private constructor(values: readonly IrAttributeDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrAttributeDecl[]): IrAttributeDecls {
    return new IrAttributeDecls([...values]);
  }

  add(value: IrAttributeDecl): IrAttributeDecls {
    return new IrAttributeDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrAttributeDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrAttributeDecl[] {
    return this.#values;
  }
}

export interface IrEntityDecl {
  readonly name: string;
  readonly attributes: IrAttributeDecls;
}

export class IrEntityDecls {
  readonly #values: readonly IrEntityDecl[];

  private constructor(values: readonly IrEntityDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrEntityDecl[]): IrEntityDecls {
    return new IrEntityDecls([...values]);
  }

  add(value: IrEntityDecl): IrEntityDecls {
    return new IrEntityDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrEntityDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrEntityDecl[] {
    return this.#values;
  }
}

export interface IrTemporalDecl {
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
}

export interface IrObligationDecl {
  readonly id: string;
  readonly assert?: Expression;
  readonly guard?: Expression;
  readonly effect?: Expression;
  readonly temporal?: IrTemporalDecl;
}

export class IrObligationDecls {
  readonly #values: readonly IrObligationDecl[];

  private constructor(values: readonly IrObligationDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrObligationDecl[]): IrObligationDecls {
    return new IrObligationDecls([...values]);
  }

  add(value: IrObligationDecl): IrObligationDecls {
    return new IrObligationDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrObligationDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrObligationDecl[] {
    return this.#values;
  }
}

// bindings は宣言順を保つ組の列（Object.entries の順序がエラー順序に出る）。
// 値は契約1 が許す JSON 値そのもので、型不一致の報告に JSON.stringify で
// 現れるため素の値のまま運ぶ。
export class IrBindingPairs {
  readonly #values: readonly (readonly [string, unknown])[];

  private constructor(values: readonly (readonly [string, unknown])[]) {
    this.#values = values;
  }

  static of(values: readonly (readonly [string, unknown])[]): IrBindingPairs {
    return new IrBindingPairs([...values]);
  }

  add(value: readonly [string, unknown]): IrBindingPairs {
    return new IrBindingPairs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<readonly [string, unknown]> {
    yield* this.#values;
  }

  toArray(): readonly (readonly [string, unknown])[] {
    return this.#values;
  }
}

export interface IrScenarioDecl {
  readonly id: string;
  readonly bindings: IrBindingPairs;
  readonly hasEvent: boolean;
  readonly expect?: Expression;
}

export class IrScenarioDecls {
  readonly #values: readonly IrScenarioDecl[];

  private constructor(values: readonly IrScenarioDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrScenarioDecl[]): IrScenarioDecls {
    return new IrScenarioDecls([...values]);
  }

  add(value: IrScenarioDecl): IrScenarioDecls {
    return new IrScenarioDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrScenarioDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrScenarioDecl[] {
    return this.#values;
  }
}

export interface IrBackgroundDecl {
  readonly id: string;
  readonly assert?: Expression;
}

export class IrBackgroundDecls {
  readonly #values: readonly IrBackgroundDecl[];

  private constructor(values: readonly IrBackgroundDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrBackgroundDecl[]): IrBackgroundDecls {
    return new IrBackgroundDecls([...values]);
  }

  add(value: IrBackgroundDecl): IrBackgroundDecls {
    return new IrBackgroundDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrBackgroundDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrBackgroundDecl[] {
    return this.#values;
  }
}

export interface IrModelDeclSeed {
  readonly entities: IrEntityDecls;
  readonly obligations: IrObligationDecls;
  readonly scenarios: IrScenarioDecls;
  readonly background: IrBackgroundDecls;
}

interface AttributeType {
  readonly kind: string;
  readonly values?: IrDeclaredValues;
}

export class IrModelDecl {
  readonly #entities: IrEntityDecls;
  readonly #obligations: IrObligationDecls;
  readonly #scenarios: IrScenarioDecls;
  readonly #background: IrBackgroundDecls;

  private constructor(seed: IrModelDeclSeed) {
    this.#entities = seed.entities;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタの寛容パースからの唯一の構築口。
  static reconstitute(seed: IrModelDeclSeed): IrModelDecl {
    return new IrModelDecl(seed);
  }

  // ModelWellFormedness — スキーマを超えた意味的整合性（旧
  // modelWellFormednessErrors の逐語移植）。
  wellFormednessErrors(): string[] {
    const errors: string[] = [];
    const attrTypes = new Map<string, AttributeType>();

    const entityNames = new Set<string>();
    for (const ent of this.#entities) {
      if (entityNames.has(ent.name)) errors.push(`schema: duplicate entity "${ent.name}"`);
      entityNames.add(ent.name);
      const attrNames = new Set<string>();
      for (const attr of ent.attributes) {
        if (attrNames.has(attr.name)) {
          errors.push(`schema: duplicate attribute "${ent.name}.${attr.name}"`);
        }
        attrNames.add(attr.name);
        if (attr.kind === "int" && attr.min !== undefined && attr.max !== undefined && attr.min > attr.max) {
          errors.push(`schema: ${ent.name}.${attr.name}: min > max`);
        }
        attrTypes.set(`${ent.name}.${attr.name}`, { kind: attr.kind, values: attr.values });
      }
    }

    const checkExpr = (e: Expression, where: string, primesAllowed: boolean): void => {
      walkExpression(e, (node) => {
        if (node.op === "ref" && typeof node.path === "string") {
          if (!attrTypes.has(node.path)) {
            errors.push(`${where}: unresolvable reference "${node.path}"`);
          }
          if (node.prime === true && !primesAllowed) {
            errors.push(`${where}: primed reference "${node.path}" is only legal in event effects and event-scenario expectations`);
          }
        }
        if (node.op === "enum" && typeof node.value === "string") {
          const known = [...attrTypes.values()].some((t) => t.kind === "enum" && (t.values?.includes(node.value as string) ?? false));
          if (!known) {
            errors.push(`${where}: enum literal "${node.value}" is not a value of any declared enum attribute`);
          }
        }
      });
    };

    const seenIds = new Set<string>();
    const dupCheck = (id: string, where: string): void => {
      if (seenIds.has(id)) errors.push(`${where}: duplicate id "${id}"`);
      seenIds.add(id);
    };

    for (const ob of this.#obligations) {
      const where = `obligation ${ob.id}`;
      dupCheck(ob.id, where);
      if (ob.assert !== undefined) checkExpr(ob.assert, where, false);
      if (ob.guard !== undefined) checkExpr(ob.guard, where, false);
      if (ob.effect !== undefined) checkExpr(ob.effect, where, true);
      if (ob.temporal !== undefined) {
        const t = ob.temporal;
        if (t.assert !== undefined) checkExpr(t.assert, where, false);
        if (t.from !== undefined) checkExpr(t.from, where, false);
        if (t.to !== undefined) checkExpr(t.to, where, false);
      }
    }

    for (const sc of this.#scenarios) {
      const where = `scenario ${sc.id}`;
      dupCheck(sc.id, where);
      for (const [path, val] of sc.bindings) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(`${where}: binding for unknown attribute "${path}"`);
          continue;
        }
        const ok =
          (t.kind === "bool" && typeof val === "boolean") ||
          (t.kind === "int" && typeof val === "number" && Number.isInteger(val)) ||
          (t.kind === "enum" && typeof val === "string" && (t.values?.includes(val) ?? false));
        if (!ok) {
          errors.push(`${where}: binding value ${JSON.stringify(val)} does not fit ${t.kind} attribute "${path}"`);
        }
      }
      if (sc.expect !== undefined) checkExpr(sc.expect, where, sc.hasEvent);
    }

    for (const bg of this.#background) {
      dupCheck(bg.id, `background ${bg.id}`);
      if (bg.assert !== undefined) checkExpr(bg.assert, `background ${bg.id}`, false);
    }

    return errors;
  }
}
