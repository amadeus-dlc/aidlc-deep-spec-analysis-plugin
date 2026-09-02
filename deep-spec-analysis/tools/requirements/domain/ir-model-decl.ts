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
import { type IrAttributeDecl } from "./ir-attribute-decl.ts";
import { IrBackgroundDecls } from "./ir-background-decls.ts";
import { IrEntityDecls } from "./ir-entity-decls.ts";
import { IrObligationDecls } from "./ir-obligation-decls.ts";
import { IrScenarioDecls } from "./ir-scenario-decls.ts";


















export class IrModelDecl {
  readonly #entities: IrEntityDecls;
  readonly #obligations: IrObligationDecls;
  readonly #scenarios: IrScenarioDecls;
  readonly #background: IrBackgroundDecls;

  private constructor(seed: {
    readonly entities: IrEntityDecls;
    readonly obligations: IrObligationDecls;
    readonly scenarios: IrScenarioDecls;
    readonly background: IrBackgroundDecls;
  }) {
    this.#entities = seed.entities;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタの寛容パースからの唯一の構築口。
  static reconstitute(seed: {
    readonly entities: IrEntityDecls;
    readonly obligations: IrObligationDecls;
    readonly scenarios: IrScenarioDecls;
    readonly background: IrBackgroundDecls;
  }): IrModelDecl {
    return new IrModelDecl(seed);
  }

  // ModelWellFormedness — スキーマを超えた意味的整合性（旧
  // modelWellFormednessErrors の逐語移植）。
  wellFormednessErrors(): string[] {
    const errors: string[] = [];
    // 主従の裁定（#71 波1）: カタログは宣言そのものを保持し、判断は宣言へ
    // 命じる——判事は文言（凍結面）だけを所有する。
    const attrTypes = new Map<string, IrAttributeDecl>();

    const entityNames = new Set<string>();
    for (const ent of this.#entities) {
      const entName = ent.name().asString();
      if (entityNames.has(entName)) errors.push(`schema: duplicate entity "${entName}"`);
      entityNames.add(entName);
      // 座標と重複はエンティティ宣言に問う（#71 波14）。
      ent.inspectAttributes((coord, attr, duplicated) => {
        if (duplicated) {
          errors.push(`schema: duplicate attribute "${coord}"`);
        }
        if (attr.boundsInverted()) {
          errors.push(`schema: ${coord}: min > max`);
        }
        if (attr.boundsOutsideSafeRange()) {
          errors.push(`schema: ${coord}: bounds must be safe integers`);
        }
        attrTypes.set(coord, attr);
      });
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
          const known = [...attrTypes.values()].some((t) => t.admitsEnumLiteral(node.value as string));
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
      const where = `obligation ${ob.id().asString()}`;
      dupCheck(ob.id().asString(), where);
      ob.inspectExpressions((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }

    for (const sc of this.#scenarios) {
      const where = `scenario ${sc.id().asString()}`;
      dupCheck(sc.id().asString(), where);
      for (const [path, val] of sc.bindings()) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(`${where}: binding for unknown attribute "${path}"`);
          continue;
        }
        if (!t.fitsBinding(val)) {
          errors.push(`${where}: binding value ${JSON.stringify(val)} does not fit ${t.kindLabel()} attribute "${path}"`);
        }
      }
      sc.inspectExpectation((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }

    for (const bg of this.#background) {
      const where = `background ${bg.id().asString()}`;
      dupCheck(bg.id().asString(), where);
      bg.inspectExpressions((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }

    return errors;
  }
}
