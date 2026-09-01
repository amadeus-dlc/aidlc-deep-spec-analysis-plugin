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

import { type Expression, Expressions } from "../../kernel/domain/index.ts";
import { IrBackgroundDecls } from "./ir-background-decls.ts";
import { IrDeclaredValues } from "./ir-declared-values.ts";
import { IrEntityDecls } from "./ir-entity-decls.ts";
import type { IrModelDeclSeed } from "./ir-model-decl-seed.ts";
import { IrObligationDecls } from "./ir-obligation-decls.ts";
import { IrScenarioDecls } from "./ir-scenario-decls.ts";


















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
      const entName = ent.name.asString();
      if (entityNames.has(entName)) errors.push(`schema: duplicate entity "${entName}"`);
      entityNames.add(entName);
      const attrNames = new Set<string>();
      for (const attr of ent.attributes) {
        const attrName = attr.name.asString();
        if (attrNames.has(attrName)) {
          errors.push(`schema: duplicate attribute "${entName}.${attrName}"`);
        }
        attrNames.add(attrName);
        if (attr.kind === "int" && attr.min !== undefined && attr.max !== undefined && attr.min.exceeds(attr.max)) {
          errors.push(`schema: ${entName}.${attrName}: min > max`);
        }
        if (
          (attr.min !== undefined && !Number.isSafeInteger(attr.min.asNumber())) ||
          (attr.max !== undefined && !Number.isSafeInteger(attr.max.asNumber()))
        ) {
          errors.push(`schema: ${entName}.${attrName}: bounds must be safe integers`);
        }
        attrTypes.set(`${entName}.${attrName}`, { kind: attr.kind, values: attr.values });
      }
    }

    // SMT 変数符号化はドットを下線に潰すため、下線を含む識別子どうしで
    // パスが衝突しうる（"a.b_c" と "a_b.c"）。衝突は検証器の変数を混線させる
    // ので well-formedness で弾く（凍結解除 #34 項 1——特殊文字はスキーマの
    // identifier パターンが既に締めており、衝突だけが生き残っていた）。
    const encoded = new Map<string, string>();
    for (const path of attrTypes.keys()) {
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(`schema: attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`);
      } else {
        encoded.set(key, path);
      }
    }

    const checkExpr = (e: Expression, where: string, primesAllowed: boolean): void => {
      Expressions.walk(e, (node) => {
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
      const where = `obligation ${ob.id.asString()}`;
      dupCheck(ob.id.asString(), where);
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
      const where = `scenario ${sc.id.asString()}`;
      dupCheck(sc.id.asString(), where);
      for (const [path, val] of sc.bindings) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(`${where}: binding for unknown attribute "${path}"`);
          continue;
        }
        const ok =
          (t.kind === "bool" && typeof val === "boolean") ||
          (t.kind === "int" && typeof val === "number" && Number.isSafeInteger(val)) ||
          (t.kind === "enum" && typeof val === "string" && (t.values?.includes(val) ?? false));
        if (!ok) {
          errors.push(`${where}: binding value ${JSON.stringify(val)} does not fit ${t.kind} attribute "${path}"`);
        }
      }
      if (sc.expect !== undefined) checkExpr(sc.expect, where, sc.hasEvent);
    }

    for (const bg of this.#background) {
      dupCheck(bg.id.asString(), `background ${bg.id.asString()}`);
      if (bg.assert !== undefined) checkExpr(bg.assert, `background ${bg.id.asString()}`, false);
    }

    return errors;
  }
}
