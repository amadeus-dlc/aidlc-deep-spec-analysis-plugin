import { TargetId } from "../../kernel/domain/index.ts";
import type { RefinementAttr } from "./refinement-attr.ts";
// refinement の SMT-LIB コンパイラ — v1（requirements/adapter/smt-plan）と
// 統一しない**明示的な第 2 コンパイラ**（移行計画のアーキテクチャ判断 Q1 /
// 移行 PR8 で確定——描画語彙は kernel 共有、式コンパイラは ref の解決表と
// bare-enum 文言が文脈別に凍結されるため 2 命名のまま。スクリプトバイトは
// キャラクタライゼーションスナップショットが固定する）。設計ユニットの属性表・型境界・背景・不変量から
// pre/post の基底を組み、alpha 置換済みの要件性質で 4 種のクエリ
// （rv: 静的違反・re: enabledness・rs2: ワンステップシミュレーション・
// rs: シナリオ再生）を発行する。alpha / SMT コンパイルの失敗は凍結文言の
// compile-error skip（facts.compileSkips）に落ちる。
// 旧 refinement-lib の designSmtCtx / smtOfExpr / designBase / assembleQuery /
// decodeDesignModel とクエリ構築部からの逐語移植。

import { ObligationId, ScenarioId } from "../../refinement/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import { smtIntOf, smtLit, smtName, smtVar } from "../../kernel/adapter/index.ts";
import { DesignSkips } from "../domain/index.ts";
import type { DesignSkipped, DesignUnit, DesignValue } from "../domain/index.ts";
import type { RefinementChildQuery } from "./refinement-child-query.ts";
import type { RefinementSmtContext } from "./refinement-smt-context.ts";
import {
  type DesignEvent,
  type RefinementProbe,
  type RefinementRequirements,
  RefinementSolverFacts,
  type UnitRefinementPlan,
  DesignEventCatalog,
  EffectAssignments,
} from "../../refinement/domain/index.ts";



class SmtCompileError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function isRecord(v: DesignValue): v is { [k: string]: DesignValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function refinementSmtContext(u: DesignUnit): RefinementSmtContext {
  const attrs: RefinementAttr[] = [];
  const rawEntities = u.rawEntities();
  if (Array.isArray(rawEntities)) {
    for (const ent of rawEntities) {
      if (!isRecord(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isRecord(attr) || typeof attr.name !== "string" || !isRecord(attr.type)) continue;
        const t = attr.type;
        if (t.kind !== "bool" && t.kind !== "int" && t.kind !== "enum") continue;
        attrs.push({
          path: `${ent.name}.${attr.name}`,
          kind: t.kind,
          min: typeof t.min === "number" ? t.min : undefined,
          max: typeof t.max === "number" ? t.max : undefined,
          values: Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        });
      }
    }
  }
  return { attrs, byPath: new Map(attrs.map((a) => [a.path, a])) };
}

function enumCode(ctx: RefinementSmtContext, attrPath: string, value: string): number {
  const attr = ctx.byPath.get(attrPath);
  if (!attr || attr.kind !== "enum" || !attr.values) throw new SmtCompileError(`"${attrPath}" is not an enum attribute`);
  const idx = attr.values.indexOf(value);
  if (idx < 0) throw new SmtCompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}

export function smtOfExpr(ctx: RefinementSmtContext, e: Expression): string {
  const bin = (op: string): string => {
    const [a, b] = e.args ?? [];
    if (!a || !b) throw new SmtCompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(ctx, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOfExpr(ctx, a);
      const right = b === enumArg ? code : smtOfExpr(ctx, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg) throw new SmtCompileError("enum literal without a ref sibling has no resolvable encoding");
    return `(${op} ${smtOfExpr(ctx, a)} ${smtOfExpr(ctx, b)})`;
  };
  switch (e.op) {
    case "and":
    case "or":
      return `(${e.op} ${(e.args ?? []).map((a) => smtOfExpr(ctx, a)).join(" ")})`;
    case "not":
      return `(not ${smtOfExpr(ctx, (e.args ?? [])[0] as Expression)})`;
    case "implies":
      return bin("=>");
    case "iff":
    case "eq":
      return bin("=");
    case "ne":
      return `(not ${bin("=")})`;
    case "lt":
      return bin("<");
    case "le":
      return bin("<=");
    case "gt":
      return bin(">");
    case "ge":
      return bin(">=");
    case "add":
      return bin("+");
    case "sub":
      return bin("-");
    case "mul":
      return bin("*");
    case "ref": {
      if (typeof e.path !== "string" || !ctx.byPath.has(e.path)) throw new SmtCompileError(`unresolvable reference "${e.path ?? ""}"`);
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n)) throw new SmtCompileError("int literal is not an integer");
      return smtLit(n);
    }
    default:
      throw new SmtCompileError(`unknown operator "${e.op}"`);
  }
}


interface NamedConstraint {
  name: string;
  smt: string;
}

export function designBase(
  ctx: RefinementSmtContext,
  u: DesignUnit,
  primed: boolean,
): { decls: string[]; constraints: NamedConstraint[] } {
  const decls: string[] = [];
  const constraints: NamedConstraint[] = [];
  for (const attr of ctx.attrs) {
    const sort = attr.kind === "bool" ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path, primed)} ${sort})`);
    const v = smtVar(attr.path, primed);
    if (attr.kind === "enum" && attr.values) {
      constraints.push({ name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`, smt: `(and (>= ${v} 0) (<= ${v} ${attr.values.length - 1}))` });
    } else if (attr.kind === "int" && (attr.min !== undefined || attr.max !== undefined)) {
      const parts: string[] = [];
      if (attr.min !== undefined) parts.push(`(>= ${v} ${smtLit(attr.min)})`);
      if (attr.max !== undefined) parts.push(`(<= ${v} ${smtLit(attr.max)})`);
      constraints.push({ name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`, smt: parts.length === 1 ? (parts[0] as string) : `(and ${parts.join(" ")})` });
    }
  }
  if (!primed) {
    for (const bg of u.background()) {
      try {
        constraints.push({ name: smtName("bg", bg.id.asString()), smt: smtOfExpr(ctx, bg.assert) });
      } catch {
        // コンパイルできない背景は落とす——設計パスが報告する。
      }
    }
    for (const ob of u.obligations()) {
      const assertion = ob.assertion();
      if (ob.isInvariantLike() && assertion !== undefined) {
        try {
          constraints.push({ name: smtName("inv", ob.id().asString()), smt: smtOfExpr(ctx, assertion) });
        } catch {
          // 同上。
        }
      }
    }
  }
  return { decls, constraints };
}

export function assembleQuery(
  id: string,
  decls: string[],
  constraints: NamedConstraint[],
  modelVars: { name: string; sort: "Int" | "Bool" }[],
): RefinementChildQuery {
  const script = [
    ...decls,
    ...constraints.flatMap((c) => [`(declare-const ${c.name} Bool)`, `(assert (=> ${c.name} ${c.smt}))`]),
  ].join("\n");
  return { id, script, assumptions: constraints.map((c) => c.name), model: modelVars };
}

export function decodeDesignModel(
  ctx: RefinementSmtContext,
  model: { [name: string]: string },
  primed: boolean,
): { [path: string]: DesignValue } {
  const out: { [path: string]: DesignValue } = {};
  for (const attr of [...ctx.attrs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const raw = model[smtVar(attr.path, primed)];
    if (raw === undefined) continue;
    if (attr.kind === "bool") out[attr.path] = raw === "true";
    else {
      const n = smtIntOf(raw);
      if (!Number.isSafeInteger(n)) {
        // 安全整数範囲外は number で正確に持てない——正確な十進文字列で運ぶ
        //（凍結解除 #34 項 4。読めない生値はそのまま生値）。
        const m = raw.match(/^\(-\s*(\d+)\)$/);
        out[attr.path] = m ? `-${m[1]}` : raw;
      } else if (attr.kind === "enum" && attr.values) out[attr.path] = attr.values[n] ?? n;
      else out[attr.path] = n;
    }
  }
  return out;
}

export interface RefinementQueryPlan {
  queries: RefinementChildQuery[];
  facts: RefinementSolverFacts;
  context: RefinementSmtContext;
}

// クエリ計画の構築 — 旧 runUnitRefinementSmt のクエリ構築部（867-999 行）。
// alpha / SMT コンパイル失敗は凍結文言の compile-error skip として facts に載る。
export function buildRefinementQueries(
  u: DesignUnit,
  req: RefinementRequirements,
  plan: UnitRefinementPlan,
): RefinementQueryPlan {
  const ctx = refinementSmtContext(u);
  const pre = designBase(ctx, u, false);
  const post = designBase(ctx, u, true);
  const modelVars = ctx.attrs.map((a) => ({ name: smtVar(a.path, false), sort: (a.kind === "bool" ? "Bool" : "Int") as "Int" | "Bool" }));
  const modelVarsBoth = [...modelVars, ...ctx.attrs.map((a) => ({ name: smtVar(a.path, true), sort: (a.kind === "bool" ? "Bool" : "Int") as "Int" | "Bool" }))];
  const catalog = DesignEventCatalog.of(u);
  const queries: RefinementChildQuery[] = [];
  const pending = new Map<string, RefinementProbe>();
  const compileSkips: DesignSkipped[] = [];
  const alphaFail = (target: string, err: unknown): void => {
    compileSkips.push({ target: TargetId.reconstitute(target), reason: "compile-error", unit: u.name(), detail: `alpha substitution failed: ${err instanceof Error ? err.message : String(err)}` });
  };

  const alphaCtx = plan.alphaContext();
  for (const [obId, st] of plan.sortedObligationStatuses()) {
    if (st.kind !== "checkable") continue;
    const ob = req.obligationById(obId);
    if (!ob) continue;
    const assertion = ob.assertion();
    if (ob.isInvariantLike() && assertion !== undefined) {
      try {
        const alphaP = alphaCtx.substitute(assertion, false);
        const q = assembleQuery(`rv:${obId}`, pre.decls, [...pre.constraints, { name: smtName("neg", obId), smt: `(not ${smtOfExpr(ctx, alphaP)})` }], modelVars);
        queries.push(q);
        pending.set(q.id, { kind: "invariant", reqId: ObligationId.reconstitute(obId) });
      } catch (err) {
        alphaFail(obId, err);
      }
      continue;
    }
    const event = ob.eventDefinition();
    if (event !== null) {
      const mapped = plan.mappedTransitionsOf(obId);
      try {
        const alphaG = alphaCtx.substitute(event.guard, false);
        // enabledness：alpha(guard) は成り立つが、写像済み設計イベントが
        // ひとつも発火可能でない。
        const designGuards = mapped
          .map((id) => catalog.eventOf(id.asString()))
          .filter((d): d is DesignEvent => d !== null)
          .map((d) => smtOfExpr(ctx, d.guard));
        const notEnabled = designGuards.length === 0 ? "true" : `(not (or ${designGuards.join(" ")}))`;
        const qe = assembleQuery(
          `re:${obId}`,
          pre.decls,
          [
            ...pre.constraints,
            { name: smtName("ag", obId), smt: smtOfExpr(ctx, alphaG) },
            { name: smtName("ne", obId), smt: notEnabled },
          ],
          modelVars,
        );
        queries.push(qe);
        pending.set(qe.id, { kind: "enabledness", reqId: ObligationId.reconstitute(obId) });

        // 写像済み設計イベントごとのワンステップシミュレーション：alpha(guard)
        // が成り立つところで踏んだ 1 歩の抽象 post が、要件効果か抽象フレーム
        // （Q2：未代入の要件属性は抽象値を保つ。unmapped 属性のフレーム等式は
        // 検査不能なので省く）に反する。
        const assigned = EffectAssignments.ofEffect(event.effect);
        const frameParts: string[] = [];
        for (const a of req.attributes().sortedByPath()) {
          if (assigned.covers(a.path.asString())) continue;
          const eq = alphaCtx.equalityFor(a.path.asString());
          if (eq !== null) frameParts.push(smtOfExpr(ctx, eq));
        }
        const fBar = smtOfExpr(ctx, alphaCtx.substitute(event.effect, false));
        const postCond = frameParts.length === 0 ? fBar : `(and ${fBar} ${frameParts.join(" ")})`;
        for (const designId of mapped) {
          const ev = catalog.eventOf(designId.asString());
          if (!ev) continue;
          const stepParts: string[] = [smtOfExpr(ctx, ev.guard)];
          for (const attr of ctx.attrs) {
            const rhs = ev.effectAssign.rhsOf(attr.path);
            const target = smtVar(attr.path, true);
            if (rhs) {
              const rhsSmt = rhs.op === "enum" && typeof rhs.value === "string"
                ? String(enumCode(ctx, attr.path, rhs.value))
                : smtOfExpr(ctx, rhs);
              stepParts.push(`(= ${target} ${rhsSmt})`);
            } else {
              stepParts.push(`(= ${target} ${smtVar(attr.path, false)})`);
            }
          }
          const qs = assembleQuery(
            `rs2:${obId}:${designId.asString()}`,
            [...pre.decls, ...post.decls],
            [
              ...pre.constraints,
              ...post.constraints,
              { name: smtName("step", designId.asString()), smt: `(and ${stepParts.join(" ")})` },
              { name: smtName("ag2", obId), smt: smtOfExpr(ctx, alphaG) },
              { name: smtName("viol", obId), smt: `(not ${postCond})` },
            ],
            modelVarsBoth,
          );
          queries.push(qs);
          pending.set(qs.id, { kind: "simulation", reqId: ObligationId.reconstitute(obId), designId });
        }
      } catch (err) {
        alphaFail(obId, err);
      }
    }
  }

  for (const [scId, st] of plan.sortedScenarioStatuses()) {
    if (st.kind !== "checkable") continue;
    const sc = req.scenarioById(scId);
    if (!sc) continue;
    try {
      const parts: string[] = [];
      for (const [path, value] of sc.bindingEntriesCanonically()) {
        const lit: Expression = typeof value === "boolean" ? { op: "bool", value } : typeof value === "number" ? { op: "int", value } : { op: "enum", value };
        const constraint: Expression = { op: "eq", args: [{ op: "ref", path }, lit] };
        parts.push(smtOfExpr(ctx, alphaCtx.substitute(constraint, false)));
      }
      const q = assembleQuery(
        `rs:${scId}`,
        pre.decls,
        [...pre.constraints, { name: smtName("sc", scId), smt: parts.length === 1 ? (parts[0] as string) : `(and ${parts.join(" ")})` }],
        modelVars,
      );
      queries.push(q);
      pending.set(q.id, { kind: "scenario", reqId: ScenarioId.reconstitute(scId) });
    } catch (err) {
      alphaFail(scId, err);
    }
  }

  return { queries, facts: RefinementSolverFacts.of({ pending, compileSkips: DesignSkips.of(compileSkips) }), context: ctx };
}
