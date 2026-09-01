// DesignWellFormedness — 契約3 設計 IR のスキーマを超えた意味的整合性。
// ユニットごとの id 一意性（DOB/DSC/DBG/SM/TR 横断）、属性参照の解決、
// enum リテラルの所属（兄弟 ref への束縛つき）、prime の合法性、状態機械の
// 整合、そして brRefs の逆検証と BR カバレッジ。
// 旧 aidlc-sensor-deep-spec-design-ir-valid.ts の semanticErrors からの逐語
// 移植で、文言と発生順序はそのまま観測面に出る。

import { type Expression, Expressions } from "../../kernel/domain/index.ts";
import { BrReferenceIndex } from "./br-reference-index.ts";
import { type BrRefs } from "./br-refs.ts";
import { type DeclaredValues } from "./declared-values.ts";
import { type DesignUnitDecls } from "./design-unit-decls.ts";

interface AttributeType {
  readonly kind: string;
  readonly values?: DeclaredValues;
}

export function designWellFormednessErrors(units: DesignUnitDecls): string[] {
  const errors: string[] = [];
  const unitNames = new Set<string>();

  for (const unitView of units) {
    const unitName = unitView.unit.asString();
    const where = (s: string): string => `unit ${unitName}: ${s}`;
    if (unitNames.has(unitName)) errors.push(`duplicate unit "${unitName}"`);
    unitNames.add(unitName);

    // Attribute catalogue for reference/enum checks.
    const attrTypes = new Map<string, AttributeType>();
    for (const ent of unitView.entities) {
      const attrNames = new Set<string>();
      for (const attr of ent.attributes) {
        const coord = `${ent.name.asString()}.${attr.name.asString()}`;
        if (attrNames.has(attr.name.asString())) errors.push(where(`duplicate attribute "${coord}"`));
        attrNames.add(attr.name.asString());
        if (attr.kind === "int" && (attr.min === undefined || attr.max === undefined)) {
          errors.push(
            where(`${coord}: int attributes require min and max — the Quint backend needs bounded domains`),
          );
        }
        if (attr.kind === "int" && attr.min !== undefined && attr.max !== undefined && attr.min.exceeds(attr.max)) {
          errors.push(where(`${coord}: min > max`));
        }
        if (
          (attr.min !== undefined && !Number.isSafeInteger(attr.min.asNumber())) ||
          (attr.max !== undefined && !Number.isSafeInteger(attr.max.asNumber()))
        ) {
          errors.push(where(`${coord}: bounds must be safe integers`));
        }
        attrTypes.set(coord, { kind: attr.kind, values: attr.values });
      }
    }

    // SMT 変数符号化はドットを下線に潰すため、下線を含む識別子どうしで
    // パスが衝突しうる（凍結解除 #34 項 1、requirements 側と対）。
    const encoded = new Map<string, string>();
    for (const path of attrTypes.keys()) {
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(where(`attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`));
      } else {
        encoded.set(key, path);
      }
    }

    const checkExpr = (e: Expression, ctx: string, primesAllowed: boolean): void => {
      // An enum literal in a binary comparison binds to its sibling ref: the
      // value must belong to THAT attribute, not to any enum somewhere in the
      // unit (a "closed" literal on ticket.channel must not legalize
      // "closed" against ticket.status).
      const boundEnum = new Map<Expression, string>();
      Expressions.walk(e, (node) => {
        const args = node.args ?? [];
        if (args.length === 2) {
          const ref = args.find((a) => a.op === "ref" && typeof a.path === "string");
          const en = args.find((a) => a.op === "enum");
          if (ref && en) boundEnum.set(en, ref.path as string);
        }
      });
      Expressions.walk(e, (node) => {
        if (node.op === "ref" && typeof node.path === "string") {
          if (!attrTypes.has(node.path)) errors.push(where(`${ctx}: unresolvable reference "${node.path}"`));
          if (node.prime === true && !primesAllowed) {
            errors.push(where(`${ctx}: primed reference "${node.path}" is only legal in effects and event-scenario expectations`));
          }
        }
        if (node.op === "enum" && typeof node.value === "string") {
          const sibling = boundEnum.get(node);
          const siblingType = sibling === undefined ? undefined : attrTypes.get(sibling);
          if (siblingType !== undefined) {
            if (siblingType.kind !== "enum") {
              errors.push(where(`${ctx}: enum literal "${node.value}" is compared against non-enum attribute "${sibling}"`));
            } else if (!(siblingType.values?.includes(node.value) ?? false)) {
              errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of "${sibling}"`));
            }
          } else if (sibling === undefined) {
            const known = [...attrTypes.values()].some((t) => t.kind === "enum" && t.values?.includes(node.value as string));
            if (!known) errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of any declared enum attribute`));
          }
          // An unresolvable sibling ref is already reported by the ref check.
        }
      });
    };

    const seenIds = new Set<string>();
    const dup = (id: string, ctx: string): void => {
      if (seenIds.has(id)) errors.push(where(`${ctx}: duplicate id "${id}"`));
      seenIds.add(id);
    };
    const brRefsUsed = new Set<string>();
    const collectBr = (refs: BrRefs | undefined): void => {
      if (refs === undefined) return;
      for (const b of refs) brRefsUsed.add(b);
    };

    for (const ob of unitView.obligations) {
      const ctx = `obligation ${ob.id.asString()}`;
      dup(ob.id.asString(), ctx);
      collectBr(ob.brRefs);
      if (ob.origin?.isRules() === true && ob.brRefs === undefined) {
        errors.push(where(`${ctx}: origin "rules" requires brRefs`));
      }
      if (ob.assert !== undefined) checkExpr(ob.assert, ctx, false);
      if (ob.guard !== undefined) checkExpr(ob.guard, ctx, false);
      if (ob.effect !== undefined) checkExpr(ob.effect, ctx, true);
      if (ob.temporal !== undefined) {
        const t = ob.temporal;
        if (t.assert !== undefined) checkExpr(t.assert, ctx, false);
        if (t.from !== undefined) checkExpr(t.from, ctx, false);
        if (t.to !== undefined) checkExpr(t.to, ctx, false);
      }
    }

    for (const sm of unitView.stateMachines) {
      const ctx = `machine ${sm.id.asString()}`;
      dup(sm.id.asString(), ctx);
      const attrPath = sm.attrPath;
      const attr = attrTypes.get(attrPath);
      if (!attr) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not declared`));
        continue;
      }
      if (attr.kind !== "enum" || !attr.values) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not an enum — its values are the state set`));
        continue;
      }
      const states = new Set(attr.values ?? []);
      for (const s of sm.initial) {
        if (!states.has(s)) {
          errors.push(where(`${ctx}: initial state "${s}" is not a value of ${attrPath}`));
        }
      }
      const transitionCells = new Set<string>();
      for (const tr of sm.transitions) {
        const tctx = `transition ${tr.id.asString()}`;
        dup(tr.id.asString(), tctx);
        collectBr(tr.brRefs);
        for (const [k, v] of [["from", tr.from], ["to", tr.to]] as const) {
          if (v !== undefined && !states.has(v)) {
            errors.push(where(`${tctx}: ${k} state "${v}" is not a value of ${attrPath}`));
          }
        }
        if (tr.from !== undefined && tr.trigger !== undefined) {
          transitionCells.add(`${tr.from}|${tr.trigger.asString()}`);
        }
        if (tr.guard !== undefined) checkExpr(tr.guard, tctx, false);
        if (tr.effect !== undefined) {
          checkExpr(tr.effect, tctx, true);
          Expressions.walk(tr.effect, (node) => {
            if (node.op === "ref" && node.prime === true && node.path === attrPath) {
              errors.push(where(`${tctx}: the effect assigns the machine's own attribute "${attrPath}" — state' = to is implicit`));
            }
          });
        }
      }
      for (const ig of sm.ignores) {
        if (!states.has(ig.state)) {
          errors.push(where(`${ctx}: ignores state "${ig.state}" is not a value of ${attrPath}`));
        }
        if (transitionCells.has(`${ig.state}|${ig.trigger.asString()}`)) {
          errors.push(
            where(`${ctx}: ignores (${ig.state}, ${ig.trigger.asString()}) collides with a declared transition for the same (state, trigger)`),
          );
        }
      }
    }

    for (const sc of unitView.scenarios) {
      const ctx = `scenario ${sc.id.asString()}`;
      dup(sc.id.asString(), ctx);
      collectBr(sc.brRefs);
      for (const [path, val] of sc.bindings) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(where(`${ctx}: binding for unknown attribute "${path}"`));
          continue;
        }
        const ok =
          (t.kind === "bool" && typeof val === "boolean") ||
          (t.kind === "int" && typeof val === "number" && Number.isSafeInteger(val)) ||
          (t.kind === "enum" && typeof val === "string" && (t.values?.includes(val) ?? false));
        if (!ok) errors.push(where(`${ctx}: binding value ${JSON.stringify(val)} does not fit ${t.kind} attribute "${path}"`));
      }
      if (sc.expect !== undefined) checkExpr(sc.expect, ctx, sc.hasEvent);
    }

    for (const bg of unitView.background) {
      dup(bg.id.asString(), `background ${bg.id.asString()}`);
      if (bg.assert !== undefined) checkExpr(bg.assert, `background ${bg.id.asString()}`, false);
    }

    // brRefs reverse-verification + BR coverage against this unit's rules.md.
    // A unit name that matches no construction directory is an error even
    // with zero brRefs: a typo would otherwise erase the whole BR coverage
    // check silently ("Silence is a contract violation").
    if (!unitView.directoryExists) {
      errors.push(
        where(`no construction/${unitName}/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified`),
      );
    }
    const rulesMd = unitView.rulesMarkdown;
    if (rulesMd === null) {
      if (brRefsUsed.size > 0) {
        errors.push(
          where(`brRefs are used but construction/${unitName}/functional-design/rules.md was not found — they cannot be reverse-verified`),
        );
      }
    } else {
      const known = BrReferenceIndex.fromRules(rulesMd);
      for (const br of [...brRefsUsed].sort()) {
        if (!known.has(br)) errors.push(where(`brRef "${br}" does not exist in rules.md`));
      }
      const unformalizedTargets = unitView.unformalizedTargets;
      for (const br of known.sortedIds()) {
        if (!brRefsUsed.has(br) && !unformalizedTargets.covers(br)) {
          errors.push(
            where(`BR coverage: rule ${br} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation`),
          );
        }
      }
    }
  }
  return errors;
}
