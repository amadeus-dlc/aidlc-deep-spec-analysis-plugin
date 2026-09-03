// IR → SMT-LIB の検証計画ビルダ。SMT-LIB という形式の知識（変数名符号化・
// s 式・仮定間接化つき baseScript・クエリ台本）はすべてここに封じ、判定解釈に
// 必要な事実（SmtVerificationPlan）だけをドメイン語彙で返す。
// 旧 aidlc-sensor-deep-spec-verify-smt.ts の smtVar / smtName / enumCode /
// smtOf / buildPlan からの逐語移植（IrDoc → RequirementsModel の読み替えのみ）。
// 描画語彙（smtVar/smtName/smtLit/smtIntOf）は移行 PR8 で kernel 共有へ。

import { type Expression, ExpressionTree, TriggerName, KeyedIndex, KeySet, QueryLabel, TargetId, TargetIds } from "../../kernel/domain/index.ts";
import { smtIntOf, smtLit, smtName, smtVar } from "../../kernel/adapter/index.ts";
import type { SmtChildQuery } from "./smt-child-query.ts";
import { ObligationId, ScenarioId,
  SmtEventPairProbes,
  SmtVerificationPlan,
  VerificationSkips,
  type Obligation,
  type RequirementsModel,
  VerificationSkipped,
  SmtEventPairProbe,
} from "../domain/index.ts";


export interface SmtPlan {
  queries: SmtChildQuery[];
  plan: SmtVerificationPlan;
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

function enumCode(model: RequirementsModel, attrPath: string, value: string): number {
  const attr = model.attributeAt(attrPath);
  const values = attr?.declaredValues();
  if (!attr || !attr.isEnum() || !values) {
    throw new CompileError(`"${attrPath}" is not an enum attribute`);
  }
  const idx = values.indexOf(value);
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
      return smtLit(n);
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
    const raw = values[smtVar(attr.path().asString(), false)];
    if (raw === undefined) continue;
    if (attr.isBool()) {
      out[attr.path().asString()] = raw === "true";
    } else {
      const n = smtIntOf(raw);
      if (!Number.isSafeInteger(n)) {
        // 安全整数範囲外は number で正確に持てない——正確な十進文字列で運ぶ
        //（凍結解除 #34 項 4。読めない生値はそのまま生値）。
        const m = raw.match(/^\(-\s*(\d+)\)$/);
        out[attr.path().asString()] = m ? `-${m[1]}` : raw;
      } else if (attr.isEnum() && attr.declaredValues()) out[attr.path().asString()] = attr.declaredValues()?.valueAt(n) ?? n;
      else out[attr.path().asString()] = n;
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
    const sort = attr.isBool() ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path().asString(), false)} ${sort})`);
    primedDecls.push(`(declare-const ${smtVar(attr.path().asString(), true)} ${sort})`);
  }

  const typeBounds: NamedConstraint[] = [];
  const primedTypeBounds: NamedConstraint[] = [];
  for (const attr of model.attributes()) {
    const bounds = (primed: boolean): string | null => {
      const v = smtVar(attr.path().asString(), primed);
      return attr.match({
        enum: (values) => (values ? `(and (>= ${v} 0) (<= ${v} ${values.count() - 1}))` : null),
        int: (min, max) => {
          if (min === undefined && max === undefined) return null;
          const parts: string[] = [];
          if (min !== undefined) parts.push(`(>= ${v} ${smtLit(min.asNumber())})`);
          if (max !== undefined) parts.push(`(<= ${v} ${smtLit(max.asNumber())})`);
          return parts.length === 1 ? (parts[0] ?? null) : `(and ${parts.join(" ")})`;
        },
        bool: () => null,
      });
    };
    const cur = bounds(false);
    if (cur) typeBounds.push({ name: smtName("ty", attr.path().asString()), smt: cur });
    const nxt = bounds(true);
    if (nxt) primedTypeBounds.push({ name: smtName("typ", attr.path().asString()), smt: nxt });
  }

  const bg: NamedConstraint[] = [];
  for (const b of model.background()) {
    try {
      bg.push({ name: smtName("bg", b.id().asString()), smt: smtOf(model, b.assertion()) });
      labelToTarget.set(smtName("bg", b.id().asString()), b.id().asString());
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
    if (ob.isInvariantLike()) {
      const assertion = ob.assertion();
      if (assertion === undefined) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: "invariant obligation lacks an assert expression" }));
        compiled.set(ob.id().asString(), false);
        continue;
      }
      try {
        invariants.push({ name: smtName("ob", ob.id().asString()), smt: smtOf(model, assertion) });
        labelToTarget.set(smtName("ob", ob.id().asString()), ob.id().asString());
        invariantObs.push(ob);
        compiled.set(ob.id().asString(), true);
      } catch (err) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) }));
        compiled.set(ob.id().asString(), false);
      }
    } else if (ob.isEvent()) {
      const event = ob.eventDefinition();
      if (event === null) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" }));
        compiled.set(ob.id().asString(), false);
        continue;
      }
      try {
        if (ExpressionTree.of(event.guard).usesPrime()) throw new CompileError("guard must not use primed references");
        smtOf(model, event.guard);
        smtOf(model, event.effect);
        events.push(ob);
        compiled.set(ob.id().asString(), true);
      } catch (err) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) }));
        compiled.set(ob.id().asString(), false);
      }
    } else {
      // state-temporal — このバックエンドの nature 範囲外（FR6.2）。
      skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "capability", detail: `nature "${ob.nature().asString()}" is checked by a state-machine backend, not the SMT backend` }));
      compiled.set(ob.id().asString(), false);
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
    name: smtVar(a.path().asString(), false),
    sort: (a.isBool() ? "Bool" : "Int") as "Int" | "Bool",
  }));

  const queries: SmtChildQuery[] = [];

  // (a) 全 invariant/numeric 義務の大域一貫性。
  queries.push({ id: "global", script: baseScript, assumptions: baseAssumptions, model: modelVars });

  // (a) implication 形不変量の前件空虚。
  for (const ob of invariantObs) {
    const ant = ob.vacuityAntecedent();
    if (!ant) continue;
    try {
      const name = smtName("ant", ob.id().asString());
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${smtOf(model, ant)}))`].join("\n");
      queries.push({ id: `vac:${ob.id().asString()}`, script, assumptions: [...baseAssumptions, name], model: [] });
    } catch {
      // 前件は完全形 assert のコンパイルで一度通っている——到達不能。
    }
  }

  // (a) 同トリガでガードが重なり効果が矛盾するイベント対。
  const eventPairs: SmtEventPairProbe[] = [];
  const byTrigger = new Map<string, Obligation[]>();
  for (const ev of events) {
    const definition = ev.eventDefinition();
    if (definition === null) continue;
    const key = definition.trigger.asString();
    const list = byTrigger.get(key) ?? [];
    list.push(ev);
    byTrigger.set(key, list);
  }
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) continue;
        const eventA = a.eventDefinition();
        const eventB = b.eventDefinition();
        if (eventA === null || eventB === null) continue;
        const ga = { name: smtName("g", a.id().asString()), smt: smtOf(model, eventA.guard) };
        const gb = { name: smtName("g", b.id().asString()), smt: smtOf(model, eventB.guard) };
        const ea = { name: smtName("e", a.id().asString()), smt: smtOf(model, eventA.effect) };
        const eb = { name: smtName("e", b.id().asString()), smt: smtOf(model, eventB.effect) };
        labelToTarget.set(ga.name, a.id().asString());
        labelToTarget.set(gb.name, b.id().asString());
        labelToTarget.set(ea.name, a.id().asString());
        labelToTarget.set(eb.name, b.id().asString());
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
        const qOverlap = `evo:${a.id().asString()}:${b.id().asString()}`;
        const qJoint = `evj:${a.id().asString()}:${b.id().asString()}`;
        queries.push({ id: qOverlap, script: overlapScript, assumptions: [...baseAssumptions, ga.name, gb.name], model: [] });
        queries.push({
          id: qJoint,
          script: jointScript,
          assumptions: [...baseAssumptions, ...primedTypeBounds.map((c) => c.name), ga.name, gb.name, ea.name, eb.name],
          model: [],
        });
        eventPairs.push(SmtEventPairProbe.of({ qOverlap: QueryLabel.reconstitute(qOverlap), qJoint: QueryLabel.reconstitute(qJoint), a: a.id(), b: b.id(), trigger: TriggerName.reconstitute(trigger) }));
      }
    }
  }

  // (b) トリガごとの完全性ギャップ：どのガードも覆わない適法状態。
  const gapTriggers = new Map<string, string[]>();
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    const guards = list.flatMap((ev) => {
      const definition = ev.eventDefinition();
      return definition === null ? [] : [smtOf(model, definition.guard)];
    });
    const name = smtName("ng", trigger);
    const noGuard = guards.length === 1 ? `(not ${guards[0]})` : `(not (or ${guards.join(" ")}))`;
    const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${noGuard}))`].join("\n");
    queries.push({ id: `gap:${trigger}`, script, assumptions: [...baseAssumptions, name], model: modelVars });
    gapTriggers.set(
      trigger,
      list.map((ev) => ev.id()).sort((a, b) => a.compareTo(b)).map((id) => id.asString()),
    );
  }

  // (c) シナリオ検査 — v1 はイベントなしシナリオのみ。
  const scenarioQueries = new Map<string, string>();
  for (const sc of model.scenarios()) {
    if (sc.hasEvent()) {
      skipped.push(VerificationSkipped.reconstitute({ target: sc.id().asTargetId(), reason: "capability", detail: "scenarios with a When-event are not checked by the SMT backend in v1" }));
      continue;
    }
    try {
      const name = smtName("sc", sc.id().asString());
      const parts: string[] = [];
      for (const [path, value] of sc.bindingEntriesCanonically()) {
        const attr = model.attributeAt(path);
        if (!attr) throw new CompileError(`binding references unknown attribute "${path}"`);
        const v = smtVar(path, false);
        if (attr.isBool()) parts.push(`(= ${v} ${value === true})`);
        else if (attr.isInt()) {
          const n = typeof value === "number" ? value : Number.NaN;
          if (!Number.isInteger(n)) throw new CompileError(`binding for int attribute "${path}" is not an integer`);
          parts.push(`(= ${v} ${smtLit(n)})`);
        } else parts.push(`(= ${v} ${enumCode(model, path, String(value))})`);
      }
      const conj = parts.length === 1 ? (parts[0] ?? "true") : `(and ${parts.join(" ")})`;
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${conj}))`].join("\n");
      const qid = `sc:${sc.id().asString()}`;
      queries.push({ id: qid, script, assumptions: [...baseAssumptions, name], model: modelVars });
      scenarioQueries.set(sc.id().asString(), qid);
    } catch (err) {
      skipped.push(VerificationSkipped.reconstitute({ target: sc.id().asTargetId(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) }));
    }
  }

  return {
    queries,
    plan: SmtVerificationPlan.of({
      compiled: KeySet.of([...compiled].filter(([, ok]) => ok).map(([id]) => ObligationId.reconstitute(id))),
      skipped: VerificationSkips.of(skipped),
      labelToTarget: KeyedIndex.of([...labelToTarget].map(([label, target]) => [QueryLabel.reconstitute(label), TargetId.reconstitute(target)] as const)),
      eventPairs: SmtEventPairProbes.of(eventPairs),
      gapTriggers: KeyedIndex.of([...gapTriggers].map(([trigger, ids]) => [TriggerName.reconstitute(trigger), TargetIds.reconstitute(ids)] as const)),
      scenarioQueries: KeyedIndex.of([...scenarioQueries].map(([sc, qid]) => [ScenarioId.reconstitute(sc), QueryLabel.reconstitute(qid)] as const)),
    }),
  };
}
