// refinement の SMT-LIB コンパイラ — v1（requirements/adapter/smt-plan-builder）
// とは意図的に統一しない**明示的な第 2 コンパイラ**（移行計画のアーキテクチャ
// 判断 Q1 / PR8 判断点——スクリプトバイトはキャラクタライゼーション
// スナップショットが固定する）。設計ユニットの属性表・型境界・背景・不変量から
// pre/post の基底を組み、alpha 置換済みの要件性質で 4 種のクエリ
// （rv: 静的違反・re: enabledness・rs2: ワンステップシミュレーション・
// rs: シナリオ再生）を発行する。alpha / SMT コンパイルの失敗は凍結文言の
// compile-error skip（facts.compileSkips）に落ちる。
// 旧 refinement-lib の designSmtCtx / smtOfExpr / designBase / assembleQuery /
// decodeDesignModel とクエリ構築部からの逐語移植。

import type { Expression } from "../../kernel/domain/index.ts";
import { DesignSkips } from "../domain/index.ts";
import type { DesignSkipped, DesignUnit, DesignValue } from "../domain/index.ts";
import {
  type DesignEvent,
  type RefinementProbe,
  type RefinementRequirements,
  RefinementSolverFacts,
  type UnitRefinementPlan,
  DesignEventCatalog,
  EffectAssignments,
} from "../../refinement/domain/index.ts";

interface RefinementAttr {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
}

export interface RefinementSmtContext {
  attrs: RefinementAttr[]; // v1 AttrInfo と同形——ただし設計ユニットの属性
  byPath: Map<string, RefinementAttr>;
}

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

function smtVar(path: string, primed: boolean): string {
  return `${primed ? "p" : "v"}_${path.replace(/\./g, "_")}`;
}

function smtLit(n: number): string {
  return n < 0 ? `(- ${-n})` : String(n);
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

export interface RefinementChildQuery {
  id: string;
  script: string;
  assumptions: string[];
  model: { name: string; sort: "Int" | "Bool" }[];
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
        constraints.push({ name: `bg_${bg.id.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, bg.assert) });
      } catch {
        // コンパイルできない背景は落とす——設計パスが報告する。
      }
    }
    for (const ob of u.obligations()) {
      if ((ob.nature === "invariant" || ob.nature === "numeric") && ob.assert) {
        try {
          constraints.push({ name: `inv_${ob.id.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, ob.assert) });
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
      const m = raw.match(/^\(-\s*(\d+)\)$/);
      const n = m ? -Number.parseInt(m[1] ?? "0", 10) : Number.parseInt(raw, 10);
      if (attr.kind === "enum" && attr.values) out[attr.path] = attr.values[n] ?? n;
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
    compileSkips.push({ target, reason: "compile-error", unit: u.name(), detail: `alpha substitution failed: ${err instanceof Error ? err.message : String(err)}` });
  };

  const alphaCtx = plan.alphaContext();
  for (const [obId, st] of plan.sortedObligationStatuses()) {
    if (st.kind !== "checkable") continue;
    const ob = req.obligationById(obId);
    if (!ob) continue;
    if ((ob.nature === "invariant" || ob.nature === "numeric") && ob.assert) {
      try {
        const alphaP = alphaCtx.substitute(ob.assert, false);
        const q = assembleQuery(`rv:${obId}`, pre.decls, [...pre.constraints, { name: `neg_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: `(not ${smtOfExpr(ctx, alphaP)})` }], modelVars);
        queries.push(q);
        pending.set(q.id, { kind: "invariant", reqId: obId });
      } catch (err) {
        alphaFail(obId, err);
      }
      continue;
    }
    if (ob.nature === "event" && ob.guard && ob.effect) {
      const mapped = plan.mappedTransitionsOf(obId);
      try {
        const alphaG = alphaCtx.substitute(ob.guard, false);
        // enabledness：alpha(guard) は成り立つが、写像済み設計イベントが
        // ひとつも発火可能でない。
        const designGuards = mapped
          .map((id) => catalog.eventOf(id))
          .filter((d): d is DesignEvent => d !== null)
          .map((d) => smtOfExpr(ctx, d.guard));
        const notEnabled = designGuards.length === 0 ? "true" : `(not (or ${designGuards.join(" ")}))`;
        const qe = assembleQuery(
          `re:${obId}`,
          pre.decls,
          [
            ...pre.constraints,
            { name: `ag_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, alphaG) },
            { name: `ne_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: notEnabled },
          ],
          modelVars,
        );
        queries.push(qe);
        pending.set(qe.id, { kind: "enabledness", reqId: obId });

        // 写像済み設計イベントごとのワンステップシミュレーション：alpha(guard)
        // が成り立つところで踏んだ 1 歩の抽象 post が、要件効果か抽象フレーム
        // （Q2：未代入の要件属性は抽象値を保つ。unmapped 属性のフレーム等式は
        // 検査不能なので省く）に反する。
        const assigned = EffectAssignments.ofEffect(ob.effect);
        const frameParts: string[] = [];
        for (const a of req.attributes().sortedByPath()) {
          if (assigned.covers(a.path)) continue;
          const eq = alphaCtx.equalityFor(a.path);
          if (eq !== null) frameParts.push(smtOfExpr(ctx, eq));
        }
        const fBar = smtOfExpr(ctx, alphaCtx.substitute(ob.effect, false));
        const postCond = frameParts.length === 0 ? fBar : `(and ${fBar} ${frameParts.join(" ")})`;
        for (const designId of mapped) {
          const ev = catalog.eventOf(designId);
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
            `rs2:${obId}:${designId}`,
            [...pre.decls, ...post.decls],
            [
              ...pre.constraints,
              ...post.constraints,
              { name: `step_${designId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: `(and ${stepParts.join(" ")})` },
              { name: `ag2_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, alphaG) },
              { name: `viol_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: `(not ${postCond})` },
            ],
            modelVarsBoth,
          );
          queries.push(qs);
          pending.set(qs.id, { kind: "simulation", reqId: obId, designId });
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
      for (const [path, value] of Object.entries(sc.bindings).sort(([x], [y]) => (x < y ? -1 : 1))) {
        const lit: Expression = typeof value === "boolean" ? { op: "bool", value } : typeof value === "number" ? { op: "int", value } : { op: "enum", value };
        const constraint: Expression = { op: "eq", args: [{ op: "ref", path }, lit] };
        parts.push(smtOfExpr(ctx, alphaCtx.substitute(constraint, false)));
      }
      const q = assembleQuery(
        `rs:${scId}`,
        pre.decls,
        [...pre.constraints, { name: `sc_${scId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: parts.length === 1 ? (parts[0] as string) : `(and ${parts.join(" ")})` }],
        modelVars,
      );
      queries.push(q);
      pending.set(q.id, { kind: "scenario", reqId: scId });
    } catch (err) {
      alphaFail(scId, err);
    }
  }

  return { queries, facts: RefinementSolverFacts.of({ pending, compileSkips: DesignSkips.of(compileSkips) }), context: ctx };
}
