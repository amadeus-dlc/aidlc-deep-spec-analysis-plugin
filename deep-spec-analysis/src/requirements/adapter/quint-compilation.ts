// IR → Quint モジュールのコンパイラ。Quint という形式の知識（変数名符号化・
// 式構文・action/temporal/init の台本）はすべてここに封じ、判定解釈に必要な
// 事実（QuintMachinePlan）だけをドメイン語彙で返す。
// 旧 aidlc-sensor-deep-spec-verify-quint.ts の qVar / qId / qLit / quintOf /
// decomposeEffect / domainOf / quintType / compileMachine からの逐語移植。
// CQS 修正：旧 compileMachine は引数の skipped[] を破壊していた——ここでは
// コンパイル時 skip を戻り値で返す（生成されるモジュール本文・skip 文言は
// バイト同一）。

import { type Expression, ExpressionTree } from "@deep-spec/kernel-domain";
import type { CompiledQuintMachine } from "./compiled-quint-machine.ts";
import {
  type AttributeDeclaration,
  type RequirementsModel,
  VerificationSkipped,
  QuintMachineComponents,
  QuintMachinePlan,
  ObligationIds,
  type ObligationId, QuintMachineComponent, ScenarioId
} from "@deep-spec/requirements-domain";

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
    if (ExpressionTree.of(rhs).usesPrime()) throw new CompileError("assignment right-hand side must not use primed references");
    if (assignments.has(target.path)) throw new CompileError(`attribute "${target.path}" assigned twice in one effect`);
    assignments.set(target.path, rhs);
  }
  return assignments;
}

function domainOf(attr: AttributeDeclaration): string {
  return attr.match({
    bool: () => "Set(true, false)",
    enum: (values) => `Set(${(values?.toArray() ?? []).map((v) => JSON.stringify(v)).join(", ")})`,
    int: (min, max) => {
      if (min === undefined || max === undefined) {
        throw new CompileError(`int attribute "${attr.path().asString()}" lacks min/max — bounded domains are required by the quint backend`);
      }
      return `(${min.asNumber()}).to(${max.asNumber()})`;
    },
  });
}

function quintType(attr: AttributeDeclaration): string {
  return attr.match({ bool: () => "bool", int: () => "int", enum: () => "str" });
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
    const v = qVar(attr.path().asString());
    if (varToPath.has(v)) throw new CompileError(`state variable name collision: "${v}"`);
    varToPath.set(v, attr.path().asString());
  }
  const stateName = (path: string, primed: boolean): string => {
    if (model.attributeAt(path) === undefined) throw new CompileError(`unresolvable reference "${path}"`);
    if (primed) throw new CompileError("primed reference outside an effect");
    return qVar(path);
  };

  // 機械が存在する前に、全属性に有限領域が要る。
  for (const attr of attrs) domainOf(attr);

  const lines: string[] = ["module main {"];
  for (const attr of attrs) lines.push(`  var ${qVar(attr.path().asString())}: ${quintType(attr)}`);
  lines.push("");

  // 不変量面：invariant/numeric 義務・state-temporal "always" 義務・背景制約・
  // 型境界。
  const invariantComponents: QuintMachineComponent[] = [];
  // 不変量定義の emit 順（成分 → 背景制約）は凍結。
  const propDefs: { id: string; expr: Expression }[] = [];
  for (const ob of model.obligations()) {
    const assertion = ob.assertion();
    if (ob.isInvariantLike() && assertion !== undefined) {
      invariantComponents.push(QuintMachineComponent.reconstitute({ id: ob.id(), expression: assertion }));
      propDefs.push({ id: ob.id().asString(), expr: assertion });
    }
    const temporal = ob.temporal();
    if (ob.isStateTemporal() && temporal?.pattern === "always" && temporal.assert !== undefined) {
      invariantComponents.push(QuintMachineComponent.reconstitute({ id: ob.id(), expression: temporal.assert }));
      propDefs.push({ id: ob.id().asString(), expr: temporal.assert });
    }
  }
  for (const b of model.background().toArray()) propDefs.push({ id: b.id().asString(), expr: b.assertion() });

  const invExprs: string[] = [];
  for (const c of propDefs) {
    const def = qId("prop", c.id);
    lines.push(`  val ${def} = ${quintOf(c.expr, stateName)}`);
    invExprs.push(def);
  }
  const boundExprs: string[] = [];
  for (const attr of attrs) {
    attr.match({
      int: (min, max) => {
        boundExprs.push(`(${qVar(attr.path().asString())} >= ${min?.asNumber()} and ${qVar(attr.path().asString())} <= ${max?.asNumber()})`);
      },
      enum: () => {
        boundExprs.push(`${domainOf(attr)}.contains(${qVar(attr.path().asString())})`);
      },
      bool: () => {},
    });
  }
  const invAllParts = [...invExprs, ...boundExprs];
  lines.push(`  val invAll = ${invAllParts.length > 0 ? `and(${invAllParts.join(", ")})` : "true"}`);
  lines.push("");

  // init：領域・背景・不変量を満たす任意の状態。
  lines.push("  action init = {");
  for (const attr of attrs) {
    lines.push(`    nondet n_${qVar(attr.path().asString())} = ${domainOf(attr)}.oneOf()`);
  }
  const initName = (path: string, primed: boolean): string => {
    if (primed) throw new CompileError("primed reference outside an effect");
    if (model.attributeAt(path) === undefined) throw new CompileError(`unresolvable reference "${path}"`);
    return `n_${qVar(path)}`;
  };
  const initConds = propDefs.map((c) => quintOf(c.expr, initName));
  lines.push("    all {");
  for (const cond of initConds) lines.push(`      ${cond},`);
  for (const attr of attrs) lines.push(`      ${qVar(attr.path().asString())}' = n_${qVar(attr.path().asString())},`);
  lines.push("      true");
  lines.push("    }");
  lines.push("  }");
  lines.push("");

  // イベント → 明示フレームつき action（言及されない変数は不変）。
  const eventIds: ObligationId[] = [];
  const actionNames: string[] = [];
  for (const ob of model.obligations()) {
    if (!ob.isEvent()) continue;
    const event = ob.eventDefinition();
    if (event === null) {
      compileSkips.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" }));
      continue;
    }
    try {
      if (ExpressionTree.of(event.guard).usesPrime()) throw new CompileError("guard must not use primed references");
      const guard = quintOf(event.guard, stateName);
      const assignments = decomposeEffect(event.effect);
      const action = qId("ev", ob.id().asString());
      const parts: string[] = [guard];
      for (const attr of attrs) {
        const rhs = assignments.get(attr.path().asString());
        parts.push(`${qVar(attr.path().asString())}' = ${rhs ? quintOf(rhs, stateName) : qVar(attr.path().asString())}`);
      }
      lines.push(`  action ${action} = all { ${parts.join(", ")} }`);
      actionNames.push(action);
      eventIds.push(ob.id());
    } catch (err) {
      compileSkips.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) }));
    }
  }
  const idleParts = attrs.map((a) => `${qVar(a.path().asString())}' = ${qVar(a.path().asString())}`);
  lines.push(`  action idle = all { ${idleParts.join(", ")} }`);
  lines.push(`  action step = any { ${actionNames.length > 0 ? actionNames.join(", ") : "idle"} }`);
  lines.push("");

  // 時相（leads-to）プロパティ——bounded モードのみ検査される。
  const temporalNames = new Map<string, string>();
  for (const ob of model.obligations()) {
    const temporal = ob.temporal();
    if (!ob.isStateTemporal() || temporal?.pattern !== "leads-to") continue;
    if (temporal.from === undefined || temporal.to === undefined) continue;
    try {
      const from = quintOf(temporal.from, stateName);
      const to = quintOf(temporal.to, stateName);
      lines.push(`  temporal ${qId("temp", ob.id().asString())} = always(${from} implies eventually(${to}))`);
      temporalNames.set(ob.id().asString(), qId("temp", ob.id().asString()));
    } catch (err) {
      compileSkips.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err instanceof Error ? err.message : String(err) }));
    }
  }
  lines.push("");

  // シナリオ init：全属性束縛・イベントなしのシナリオのみ。
  const scenarioInitActions = new Map<string, string>();
  const scenariosWithInit: ScenarioId[] = [];
  for (const sc of model.scenarios()) {
    if (sc.hasEvent()) continue;
    const bindings = sc.bindings();
    const boundPaths = new Set(Object.keys(bindings));
    if (attrs.some((a) => !boundPaths.has(a.path().asString()))) continue;
    const parts: string[] = [];
    let okAll = true;
    for (const attr of attrs) {
      const value = bindings[attr.path().asString()];
      if (value === undefined) {
        okAll = false;
        break;
      }
      parts.push(`${qVar(attr.path().asString())}' = ${qLit(value)}`);
    }
    if (!okAll) continue;
    const initAction = qId("scInit", sc.id().asString());
    lines.push(`  action ${initAction} = all { ${parts.join(", ")} }`);
    scenarioInitActions.set(sc.id().asString(), initAction);
    scenariosWithInit.push(sc.id());
  }

  lines.push("}");
  return {
    moduleText: `${lines.join("\n")}\n`,
    plan: QuintMachinePlan.of({
      invariantComponents: QuintMachineComponents.of(invariantComponents),
      eventIds: ObligationIds.of(eventIds),
      scenariosWithInit,
    }),
    compileSkips,
    varToPath,
    scenarioInitActions,
    temporalNames,
  };
}
