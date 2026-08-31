// IR → SMT-LIB の検証計画ビルダ。SMT-LIB という形式の知識（変数名符号化・
// s 式・仮定間接化つき baseScript・クエリ台本）はすべてここに封じ、判定解釈に
// 必要な事実（SmtPlanFacts）だけをドメイン語彙で返す。
// 旧 aidlc-sensor-deep-spec-verify-smt.ts の smtVar / smtName / enumCode /
// smtOf / buildPlan からの逐語移植（IrDoc → RequirementsModel の読み替えのみ）。

import { type Expression, Expressions, IdOrder } from "../../kernel/domain/index.ts";
import {
  SmtEventPairProbes,
  SmtPlanFacts,
  VerificationSkips,
  type Obligation,
  type RequirementsModel,
  type VerificationSkipped,
  type AttributeBound,
} from "../domain/index.ts";

// 子プロセスへ渡す 1 クエリ分の台本。プロトコル（JSON 形）は design の refinement ソルバも
// 同じ子を spawn するため凍結。
export interface SmtChildQuery {
  id: string;
  script: string;
  assumptions: string[];
  model: { name: string; sort: "Int" | "Bool" }[];
}

export interface SmtPlan {
  queries: SmtChildQuery[];
  facts: SmtPlanFacts;
}

class CompileError extends Error {
  constructor(message: string) {
    super(message);
  }
}

interface NamedConstraint {
  name: string;
  smt: string;
}

export function smtVar(path: string, primed: boolean): string {
  return `${primed ? "p" : "v"}_${path.replace(/\./g, "_")}`;
}

function smtName(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

// SMT-LIB の整数リテラル描画（負数は (- n) 形——境界描画・逐語）。
function smtNumeral(bound: AttributeBound): string {
  const n = bound.asNumber();
  return n < 0 ? `(- ${-n})` : String(n);
}

function enumCode(model: RequirementsModel, attrPath: string, value: string): number {
  const attr = model.attributeAt(attrPath);
  if (!attr || attr.kind !== "enum" || !attr.values) {
    throw new CompileError(`"${attrPath}" is not an enum attribute`);
  }
  const idx = attr.values.indexOf(value);
  if (idx < 0) throw new CompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}

// 式を SMT-LIB s 式へコンパイルする。enum リテラルは int 符号化で、文脈の
// ref 兄弟から属性の値リストを解決する。
function smtOf(model: RequirementsModel, e: Expression): string {
  const bin = (op: string): string => {
    const [a, b] = e.args ?? [];
    if (!a || !b) throw new CompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(model, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOf(model, a);
      const right = b === enumArg ? code : smtOf(model, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg) throw new CompileError("enum literal without a ref sibling has no resolvable encoding");
    return `(${op} ${smtOf(model, a)} ${smtOf(model, b)})`;
  };
  switch (e.op) {
    case "and":
    case "or":
      return `(${e.op} ${(e.args ?? []).map((a) => smtOf(model, a)).join(" ")})`;
    case "not":
      return `(not ${smtOf(model, (e.args ?? [])[0] as Expression)})`;
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
      if (typeof e.path !== "string" || model.attributeAt(e.path) === undefined) {
        throw new CompileError(`unresolvable reference "${e.path ?? ""}"`);
      }
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n)) throw new CompileError("int literal is not an integer");
      return n < 0 ? `(- ${-n})` : String(n);
    }
    case "enum":
      throw new CompileError("enum literal without a ref sibling has no resolvable encoding");
    default:
      throw new CompileError(`unknown operator "${e.op}"`);
  }
}

// z3 のテキストモデルを属性パスごとの素の値へ復号する（パス昇順の挿入順が
// witness.model のキー順として文書バイトに載る）。
export function decodeSolverModel(
  model: RequirementsModel,
  values: { [name: string]: string },
): { [path: string]: boolean | number | string } {
  const out: { [path: string]: boolean | number | string } = {};
  for (const attr of model.attributes().sortedByPath()) {
    const raw = values[smtVar(attr.path.asString(), false)];
    if (raw === undefined) continue;
    if (attr.kind === "bool") {
      out[attr.path.asString()] = raw === "true";
    } else {
      const m = raw.match(/^\(-\s*(\d+)\)$/);
      const n = m ? -Number.parseInt(m[1] ?? "0", 10) : Number.parseInt(raw, 10);
      if (attr.kind === "enum" && attr.values) out[attr.path.asString()] = attr.values.valueAt(n) ?? n;
      else out[attr.path.asString()] = n;
    }
  }
  return out;
}

export function buildSmtPlan(model: RequirementsModel): SmtPlan {
  const skipped: VerificationSkipped[] = [];
  const compiled = new Map<string, boolean>();
  const labelToTarget = new Map<string, string>();

  const decls: string[] = [];
  const primedDecls: string[] = [];
  for (const attr of model.attributes()) {
    const sort = attr.kind === "bool" ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path.asString(), false)} ${sort})`);
    primedDecls.push(`(declare-const ${smtVar(attr.path.asString(), true)} ${sort})`);
  }

  const typeBounds: NamedConstraint[] = [];
  const primedTypeBounds: NamedConstraint[] = [];
  for (const attr of model.attributes()) {
    const bounds = (primed: boolean): string | null => {
      const v = smtVar(attr.path.asString(), primed);
      if (attr.kind === "enum" && attr.values) {
        return `(and (>= ${v} 0) (<= ${v} ${attr.values.count() - 1}))`;
      }
      if (attr.kind === "int" && (attr.min !== undefined || attr.max !== undefined)) {
        const parts: string[] = [];
        if (attr.min !== undefined) parts.push(`(>= ${v} ${smtNumeral(attr.min)})`);
        if (attr.max !== undefined) parts.push(`(<= ${v} ${smtNumeral(attr.max)})`);
        return parts.length === 1 ? (parts[0] ?? null) : `(and ${parts.join(" ")})`;
      }
      return null;
    };
    const cur = bounds(false);
    if (cur) typeBounds.push({ name: smtName("ty", attr.path.asString()), smt: cur });
    const nxt = bounds(true);
    if (nxt) primedTypeBounds.push({ name: smtName("typ", attr.path.asString()), smt: nxt });
  }

  const bg: NamedConstraint[] = [];
  for (const b of model.background()) {
    try {
      bg.push({ name: smtName("bg", b.id.asString()), smt: smtOf(model, b.assert) });
      labelToTarget.set(smtName("bg", b.id.asString()), b.id.asString());
    } catch (err) {
      // コンパイルできない背景仮定は全クエリから落ちる。OB/SC の id を持たない
      // ため skipped[] を占められず、不変量の detail 経由でだけ観測される。
      void err;
    }
  }

  const invariants: NamedConstraint[] = [];
  const invariantObs: Obligation[] = [];
  const events: Obligation[] = [];
  for (const ob of model.obligations()) {
    if (ob.nature.isInvariant() || ob.nature.isNumeric()) {
      if (!ob.assert) {
        skipped.push({ target: ob.id.asString(), reason: "compile-error", detail: "invariant obligation lacks an assert expression" });
        compiled.set(ob.id.asString(), false);
        continue;
      }
      try {
        invariants.push({ name: smtName("ob", ob.id.asString()), smt: smtOf(model, ob.assert) });
        labelToTarget.set(smtName("ob", ob.id.asString()), ob.id.asString());
        invariantObs.push(ob);
        compiled.set(ob.id.asString(), true);
      } catch (err) {
        skipped.push({ target: ob.id.asString(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
        compiled.set(ob.id.asString(), false);
      }
    } else if (ob.nature.isEvent()) {
      if (!ob.guard || !ob.effect || !ob.trigger) {
        skipped.push({ target: ob.id.asString(), reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" });
        compiled.set(ob.id.asString(), false);
        continue;
      }
      try {
        if (Expressions.usesPrime(ob.guard)) throw new CompileError("guard must not use primed references");
        smtOf(model, ob.guard);
        smtOf(model, ob.effect);
        events.push(ob);
        compiled.set(ob.id.asString(), true);
      } catch (err) {
        skipped.push({ target: ob.id.asString(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
        compiled.set(ob.id.asString(), false);
      }
    } else {
      // state-temporal — このバックエンドの nature 範囲外（FR6.2）。
      skipped.push({ target: ob.id.asString(), reason: "capability", detail: `nature "${ob.nature.asString()}" is checked by a state-machine backend, not the SMT backend` });
      compiled.set(ob.id.asString(), false);
    }
  }

  const baseScript = [
    ...decls,
    ...[...typeBounds, ...bg, ...invariants].flatMap((c) => [
      `(declare-const ${c.name} Bool)`,
      `(assert (=> ${c.name} ${c.smt}))`,
    ]),
  ].join("\n");
  const baseAssumptions = [...typeBounds, ...bg, ...invariants].map((c) => c.name);
  const modelVars = model.attributes().toArray().map((a) => ({
    name: smtVar(a.path.asString(), false),
    sort: (a.kind === "bool" ? "Bool" : "Int") as "Int" | "Bool",
  }));

  const queries: SmtChildQuery[] = [];

  // (a) 全 invariant/numeric 義務の大域一貫性。
  queries.push({ id: "global", script: baseScript, assumptions: baseAssumptions, model: modelVars });

  // (a) implication 形不変量の前件空虚。
  for (const ob of invariantObs) {
    if (ob.assert?.op !== "implies") continue;
    const ant = (ob.assert.args ?? [])[0];
    if (!ant) continue;
    try {
      const name = smtName("ant", ob.id.asString());
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${smtOf(model, ant)}))`].join("\n");
      queries.push({ id: `vac:${ob.id.asString()}`, script, assumptions: [...baseAssumptions, name], model: [] });
    } catch {
      // 前件は完全形 assert のコンパイルで一度通っている——到達不能。
    }
  }

  // (a) 同トリガでガードが重なり効果が矛盾するイベント対。
  const eventPairs: { qOverlap: string; qJoint: string; a: string; b: string; trigger: string }[] = [];
  const byTrigger = new Map<string, Obligation[]>();
  for (const ev of events) {
    const list = byTrigger.get(ev.trigger ?? "") ?? [];
    list.push(ev);
    byTrigger.set(ev.trigger ?? "", list);
  }
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b || !a.guard || !b.guard || !a.effect || !b.effect) continue;
        const ga = { name: smtName("g", a.id.asString()), smt: smtOf(model, a.guard) };
        const gb = { name: smtName("g", b.id.asString()), smt: smtOf(model, b.guard) };
        const ea = { name: smtName("e", a.id.asString()), smt: smtOf(model, a.effect) };
        const eb = { name: smtName("e", b.id.asString()), smt: smtOf(model, b.effect) };
        labelToTarget.set(ga.name, a.id.asString());
        labelToTarget.set(gb.name, b.id.asString());
        labelToTarget.set(ea.name, a.id.asString());
        labelToTarget.set(eb.name, b.id.asString());
        const overlapScript = [
          baseScript,
          ...[ga, gb].flatMap((c) => [`(declare-const ${c.name} Bool)`, `(assert (=> ${c.name} ${c.smt}))`]),
        ].join("\n");
        const jointScript = [
          baseScript,
          ...primedDecls,
          ...[...primedTypeBounds, ga, gb, ea, eb].flatMap((c) => [
            `(declare-const ${c.name} Bool)`,
            `(assert (=> ${c.name} ${c.smt}))`,
          ]),
        ].join("\n");
        const qOverlap = `evo:${a.id.asString()}:${b.id.asString()}`;
        const qJoint = `evj:${a.id.asString()}:${b.id.asString()}`;
        queries.push({ id: qOverlap, script: overlapScript, assumptions: [...baseAssumptions, ga.name, gb.name], model: [] });
        queries.push({
          id: qJoint,
          script: jointScript,
          assumptions: [...baseAssumptions, ...primedTypeBounds.map((c) => c.name), ga.name, gb.name, ea.name, eb.name],
          model: [],
        });
        eventPairs.push({ qOverlap, qJoint, a: a.id.asString(), b: b.id.asString(), trigger });
      }
    }
  }

  // (b) トリガごとの完全性ギャップ：どのガードも覆わない適法状態。
  const gapTriggers = new Map<string, string[]>();
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    const guards = list.map((ev) => smtOf(model, ev.guard as Expression));
    const name = smtName("ng", trigger);
    const noGuard = guards.length === 1 ? `(not ${guards[0]})` : `(not (or ${guards.join(" ")}))`;
    const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${noGuard}))`].join("\n");
    queries.push({ id: `gap:${trigger}`, script, assumptions: [...baseAssumptions, name], model: modelVars });
    gapTriggers.set(
      trigger,
      list.map((ev) => ev.id.asString()).sort(IdOrder.compare),
    );
  }

  // (c) シナリオ検査 — v1 はイベントなしシナリオのみ。
  const scenarioQueries = new Map<string, string>();
  for (const sc of model.scenarios()) {
    if (sc.event) {
      skipped.push({ target: sc.id.asString(), reason: "capability", detail: "scenarios with a When-event are not checked by the SMT backend in v1" });
      continue;
    }
    try {
      const name = smtName("sc", sc.id.asString());
      const parts: string[] = [];
      for (const [path, value] of Object.entries(sc.bindings).sort(([x], [y]) => (x < y ? -1 : 1))) {
        const attr = model.attributeAt(path);
        if (!attr) throw new CompileError(`binding references unknown attribute "${path}"`);
        const v = smtVar(path, false);
        if (attr.kind === "bool") parts.push(`(= ${v} ${value === true})`);
        else if (attr.kind === "int") {
          const n = typeof value === "number" ? value : Number.NaN;
          if (!Number.isInteger(n)) throw new CompileError(`binding for int attribute "${path}" is not an integer`);
          parts.push(`(= ${v} ${n < 0 ? `(- ${-n})` : n})`);
        } else parts.push(`(= ${v} ${enumCode(model, path, String(value))})`);
      }
      const conj = parts.length === 1 ? (parts[0] ?? "true") : `(and ${parts.join(" ")})`;
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${conj}))`].join("\n");
      const qid = `sc:${sc.id.asString()}`;
      queries.push({ id: qid, script, assumptions: [...baseAssumptions, name], model: modelVars });
      scenarioQueries.set(sc.id.asString(), qid);
    } catch (err) {
      skipped.push({ target: sc.id.asString(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    queries,
    facts: SmtPlanFacts.of({
      compiled,
      skipped: VerificationSkips.of(skipped),
      labelToTarget,
      eventPairs: SmtEventPairProbes.of(eventPairs),
      gapTriggers,
      scenarioQueries,
    }),
  };
}
