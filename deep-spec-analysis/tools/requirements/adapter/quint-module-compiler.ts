// IR → Quint モジュールのコンパイラ。Quint という形式の知識（変数名符号化・
// 式構文・action/temporal/init の台本）はすべてここに封じ、判定解釈に必要な
// 事実（QuintMachineFacts）だけをドメイン語彙で返す。
// 旧 aidlc-sensor-deep-spec-verify-quint.ts の qVar / qId / qLit / quintOf /
// decomposeEffect / domainOf / quintType / compileMachine からの逐語移植。
// CQS 修正：旧 compileMachine は引数の skipped[] を破壊していた——ここでは
// コンパイル時 skip を戻り値で返す（生成されるモジュール本文・skip 文言は
// バイト同一）。

import { type Expression, expressionUsesPrime } from "../../kernel/domain/index.ts";
import {
  type AttributeDeclaration,
  type QuintMachineFacts,
  type RequirementsModel,
  type VerificationSkipped,
} from "../domain/index.ts";

class CompileError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function qVar(path: string): string {
  return path.replace(/\./g, "_");
}

function qId(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function qLit(value: boolean | number | string): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

// 式を Quint へコンパイルする。`name` は属性パスをそれを表す Quint 式
// （状態変数・nondet 一時名・primed 変数）へ写す。
function quintOf(e: Expression, name: (path: string, primed: boolean) => string): string {
  const args = (e.args ?? []).map((a) => quintOf(a, name));
  const two = (): [string, string] => {
    if (args.length !== 2) throw new CompileError(`operator "${e.op}" needs two arguments`);
    return [args[0] ?? "", args[1] ?? ""];
  };
  switch (e.op) {
    case "and":
      return `and(${args.join(", ")})`;
    case "or":
      return `or(${args.join(", ")})`;
    case "not":
      return `not(${args[0] ?? ""})`;
    case "implies": {
      const [a, b] = two();
      return `(${a} implies ${b})`;
    }
    case "iff": {
      const [a, b] = two();
      return `(${a} iff ${b})`;
    }
    case "eq": {
      const [a, b] = two();
      return `(${a} == ${b})`;
    }
    case "ne": {
      const [a, b] = two();
      return `(${a} != ${b})`;
    }
    case "lt": {
      const [a, b] = two();
      return `(${a} < ${b})`;
    }
    case "le": {
      const [a, b] = two();
      return `(${a} <= ${b})`;
    }
    case "gt": {
      const [a, b] = two();
      return `(${a} > ${b})`;
    }
    case "ge": {
      const [a, b] = two();
      return `(${a} >= ${b})`;
    }
    case "add": {
      const [a, b] = two();
      return `(${a} + ${b})`;
    }
    case "sub": {
      const [a, b] = two();
      return `(${a} - ${b})`;
    }
    case "mul": {
      const [a, b] = two();
      return `(${a} * ${b})`;
    }
    case "ref":
      if (typeof e.path !== "string") throw new CompileError("ref without path");
      return name(e.path, e.prime === true);
    case "bool":
    case "int":
    case "enum":
      if (e.value === undefined) throw new CompileError(`${e.op} literal without value`);
      return qLit(e.value);
    default:
      throw new CompileError(`unknown operator "${e.op}"`);
  }
}

// イベント効果を primed 代入へ分解する：効果は eq(prime(ref), <prime なし式>)
// の連言で、各パスへの代入は一度きり。これが Quint と決定論の双方が要求する
// 代入形。
function decomposeEffect(effect: Expression): Map<string, Expression> {
  const assignments = new Map<string, Expression>();
  const terms: Expression[] = [];
  const flatten = (e: Expression): void => {
    if (e.op === "and") {
      for (const a of e.args ?? []) flatten(a);
    } else {
      terms.push(e);
    }
  };
  flatten(effect);
  for (const term of terms) {
    if (term.op !== "eq") throw new CompileError("effect must be a conjunction of primed assignments (eq(prime-ref, expr))");
    const [a, b] = term.args ?? [];
    const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
    const rhs = target === a ? b : a;
    if (!target || !rhs || typeof target.path !== "string") {
      throw new CompileError("effect must be a conjunction of primed assignments (eq(prime-ref, expr))");
    }
    if (expressionUsesPrime(rhs)) throw new CompileError("assignment right-hand side must not use primed references");
    if (assignments.has(target.path)) throw new CompileError(`attribute "${target.path}" assigned twice in one effect`);
    assignments.set(target.path, rhs);
  }
  return assignments;
}

function domainOf(attr: AttributeDeclaration): string {
  if (attr.kind === "bool") return "Set(true, false)";
  if (attr.kind === "enum") return `Set(${(attr.values ?? []).map((v) => JSON.stringify(v)).join(", ")})`;
  if (attr.min === undefined || attr.max === undefined) {
    throw new CompileError(`int attribute "${attr.path}" lacks min/max — bounded domains are required by the quint backend`);
  }
  return `(${attr.min}).to(${attr.max})`;
}

function quintType(attr: AttributeDeclaration): string {
  if (attr.kind === "bool") return "bool";
  if (attr.kind === "int") return "int";
  return "str";
}

// コンパイル済み機械 — モジュール本文・変数名対応・シナリオ init の action 名は
// 形式知識としてアダプタ内に留め、facts だけがドメインへ渡る。
export interface CompiledQuintMachine {
  moduleText: string;
  facts: QuintMachineFacts;
  compileSkips: VerificationSkipped[];
  varToPath: Map<string, string>;
  scenarioInitActions: Map<string, string>;
  temporalNames: Map<string, string>;
}

export type QuintCompilation =
  | { kind: "compiled"; machine: CompiledQuintMachine }
  | { kind: "uncompilable"; error: string };

export function compileQuintMachine(model: RequirementsModel): QuintCompilation {
  try {
    return { kind: "compiled", machine: compile(model) };
  } catch (err) {
    return { kind: "uncompilable", error: err instanceof Error ? err.message : String(err) };
  }
}

function compile(model: RequirementsModel): CompiledQuintMachine {
  const compileSkips: VerificationSkipped[] = [];
  const attrs = model.attributes().toArray();
  const varToPath = new Map<string, string>();
  for (const attr of attrs) {
    const v = qVar(attr.path);
    if (varToPath.has(v)) throw new CompileError(`state variable name collision: "${v}"`);
    varToPath.set(v, attr.path);
  }
  const stateName = (path: string, primed: boolean): string => {
    if (model.attributeAt(path) === undefined) throw new CompileError(`unresolvable reference "${path}"`);
    if (primed) throw new CompileError("primed reference outside an effect");
    return qVar(path);
  };

  // 機械が存在する前に、全属性に有限領域が要る。
  for (const attr of attrs) domainOf(attr);

  const lines: string[] = ["module main {"];
  for (const attr of attrs) lines.push(`  var ${qVar(attr.path)}: ${quintType(attr)}`);
  lines.push("");

  // 不変量面：invariant/numeric 義務・state-temporal "always" 義務・背景制約・
  // 型境界。
  const invariantComponents: { id: string; expr: Expression; frRefs: string[] }[] = [];
  for (const ob of model.obligations()) {
    if ((ob.nature === "invariant" || ob.nature === "numeric") && ob.assert) {
      invariantComponents.push({ id: ob.id, expr: ob.assert, frRefs: ob.frRefs });
    }
    if (ob.nature === "state-temporal" && ob.temporal?.pattern === "always" && ob.temporal.assert) {
      invariantComponents.push({ id: ob.id, expr: ob.temporal.assert, frRefs: ob.frRefs });
    }
  }
  const bgComponents = model.background().toArray().map((b) => ({ id: b.id, expr: b.assert, frRefs: [] as string[] }));

  const invExprs: string[] = [];
  for (const c of [...invariantComponents, ...bgComponents]) {
    const def = qId("prop", c.id);
    lines.push(`  val ${def} = ${quintOf(c.expr, stateName)}`);
    invExprs.push(def);
  }
  const boundExprs: string[] = [];
  for (const attr of attrs) {
    if (attr.kind === "int") {
      boundExprs.push(`(${qVar(attr.path)} >= ${attr.min} and ${qVar(attr.path)} <= ${attr.max})`);
    } else if (attr.kind === "enum") {
      boundExprs.push(`${domainOf(attr)}.contains(${qVar(attr.path)})`);
    }
  }
  const invAllParts = [...invExprs, ...boundExprs];
  lines.push(`  val invAll = ${invAllParts.length > 0 ? `and(${invAllParts.join(", ")})` : "true"}`);
  lines.push("");

  // init：領域・背景・不変量を満たす任意の状態。
  lines.push("  action init = {");
  for (const attr of attrs) {
    lines.push(`    nondet n_${qVar(attr.path)} = ${domainOf(attr)}.oneOf()`);
  }
  const initName = (path: string, primed: boolean): string => {
    if (primed) throw new CompileError("primed reference outside an effect");
    if (model.attributeAt(path) === undefined) throw new CompileError(`unresolvable reference "${path}"`);
    return `n_${qVar(path)}`;
  };
  const initConds = [...invariantComponents, ...bgComponents].map((c) => quintOf(c.expr, initName));
  lines.push("    all {");
  for (const cond of initConds) lines.push(`      ${cond},`);
  for (const attr of attrs) lines.push(`      ${qVar(attr.path)}' = n_${qVar(attr.path)},`);
  lines.push("      true");
  lines.push("    }");
  lines.push("  }");
  lines.push("");

  // イベント → 明示フレームつき action（言及されない変数は不変）。
  const eventIds: string[] = [];
  const actionNames: string[] = [];
  for (const ob of model.obligations()) {
    if (ob.nature !== "event") continue;
    if (!ob.guard || !ob.effect || !ob.trigger) {
      compileSkips.push({ target: ob.id, reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" });
      continue;
    }
    try {
      if (expressionUsesPrime(ob.guard)) throw new CompileError("guard must not use primed references");
      const guard = quintOf(ob.guard, stateName);
      const assignments = decomposeEffect(ob.effect);
      const action = qId("ev", ob.id);
      const parts: string[] = [guard];
      for (const attr of attrs) {
        const rhs = assignments.get(attr.path);
        parts.push(`${qVar(attr.path)}' = ${rhs ? quintOf(rhs, stateName) : qVar(attr.path)}`);
      }
      lines.push(`  action ${action} = all { ${parts.join(", ")} }`);
      actionNames.push(action);
      eventIds.push(ob.id);
    } catch (err) {
      compileSkips.push({ target: ob.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  const idleParts = attrs.map((a) => `${qVar(a.path)}' = ${qVar(a.path)}`);
  lines.push(`  action idle = all { ${idleParts.join(", ")} }`);
  lines.push(`  action step = any { ${actionNames.length > 0 ? actionNames.join(", ") : "idle"} }`);
  lines.push("");

  // 時相（leads-to）プロパティ——bounded モードのみ検査される。
  const temporalNames = new Map<string, string>();
  for (const ob of model.obligations()) {
    if (ob.nature !== "state-temporal" || ob.temporal?.pattern !== "leads-to") continue;
    if (!ob.temporal.from || !ob.temporal.to) continue;
    try {
      const from = quintOf(ob.temporal.from, stateName);
      const to = quintOf(ob.temporal.to, stateName);
      lines.push(`  temporal ${qId("temp", ob.id)} = always(${from} implies eventually(${to}))`);
      temporalNames.set(ob.id, qId("temp", ob.id));
    } catch (err) {
      compileSkips.push({ target: ob.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  lines.push("");

  // シナリオ init：全属性束縛・イベントなしのシナリオのみ。
  const scenarioInitActions = new Map<string, string>();
  for (const sc of model.scenarios()) {
    if (sc.event) continue;
    const boundPaths = new Set(Object.keys(sc.bindings));
    if (attrs.some((a) => !boundPaths.has(a.path))) continue;
    const parts: string[] = [];
    let okAll = true;
    for (const attr of attrs) {
      const value = sc.bindings[attr.path];
      if (value === undefined) {
        okAll = false;
        break;
      }
      parts.push(`${qVar(attr.path)}' = ${qLit(value)}`);
    }
    if (!okAll) continue;
    const initAction = qId("scInit", sc.id);
    lines.push(`  action ${initAction} = all { ${parts.join(", ")} }`);
    scenarioInitActions.set(sc.id, initAction);
  }

  lines.push("}");
  return {
    moduleText: `${lines.join("\n")}\n`,
    facts: {
      invariantComponents,
      eventIds,
      scenariosWithInit: new Set(scenarioInitActions.keys()),
    },
    compileSkips,
    varToPath,
    scenarioInitActions,
    temporalNames,
  };
}
