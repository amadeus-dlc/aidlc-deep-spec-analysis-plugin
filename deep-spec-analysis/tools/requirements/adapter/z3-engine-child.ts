import type { SmtChildResult } from "./smt-child-result.ts";
// z3 実行の子プロセス本体。stdin の {queries, timeoutMs, budgetMs} を解いて
// z3-solver（WASM）でクエリを流し、{results} または {unavailable} の JSON
// 1 行を返す。プロトコルは凍結——design の refinement ソルバも同じ子（エントリの
// --smt-child）へ独自ペイロードを spawn する。stdout への書出と exit は
// entry の責務（本モジュールは行を返すだけ）。
// 旧 childMain からの逐語移植。
//
// ランタイム注記: z3-solver の Emscripten pthread ビルドは bun のプロセス内
// では abort する（2026-08 検証、bun 1.3.13）ため、解決は常に子プロセス
// （node 優先・bun フォールバック）で行われる。

import { readFileSync } from "node:fs";
import { type SmtChildQuery } from "./smt-child-query.ts";


export async function solveSmtChild(): Promise<string> {
  let payload: { queries: SmtChildQuery[]; timeoutMs: number; budgetMs: number };
  try {
    payload = JSON.parse(readFileSync(0, "utf-8"));
  } catch (err) {
    return `${JSON.stringify({ unavailable: `child payload unreadable: ${err instanceof Error ? err.message : String(err)}` })}\n`;
  }
  let api: {
    Context: (name: string) => unknown;
    em: { PThread: { terminateAllThreads: () => void } };
  };
  try {
    const mod = await import("z3-solver");
    api = (await mod.init()) as unknown as typeof api;
  } catch (err) {
    return `${JSON.stringify({ unavailable: `z3-solver is not available in this project: ${err instanceof Error ? err.message : String(err)}` })}\n`;
  }
  // 高水準 API は型なしで使う：z3-solver は任意ランタイムであり、プラグインが
  // 型依存を持ってはならない。
  // biome-ignore lint/suspicious/noExplicitAny: optional runtime, no type dep
  const Z3 = api.Context("main") as any;
  const results: SmtChildResult[] = [];
  // 決定化（#28）: z3-solver の高水準 API は JS ラッパの GC 時に
  // FinalizationRegistry 経由で dec_ref を発行する。負荷で GC タイミングが
  // 変わると z3 内部の解放・ID 再利用パターンが揺れ、制約上自由な変数の
  // モデル値が稀に変わりうる。子プロセスの寿命は短いので、生成した全ラッパを
  // 実行終了まで保持して実行中の dec_ref をゼロにする——軽負荷時（GC 無発火）の
  // 典型アロケーションパターンを全負荷条件で再現するため、golden バイトは
  // 構成上不変。
  const retained: unknown[] = [];
  const started = Date.now();
  for (const q of payload.queries) {
    if (Date.now() - started > payload.budgetMs) {
      results.push({ id: q.id, status: "budget" });
      continue;
    }
    try {
      const solver = new Z3.Solver();
      retained.push(solver);
      solver.set("timeout", payload.timeoutMs);
      solver.fromString(q.script);
      const assumptions = q.assumptions.map((n: string) => Z3.Bool.const(n));
      retained.push(assumptions);
      const status = (await solver.check(...assumptions)) as string;
      if (status === "sat") {
        const model = solver.model();
        retained.push(model);
        const values: { [name: string]: string } = {};
        for (const m of q.model) {
          const c = m.sort === "Bool" ? Z3.Bool.const(m.name) : Z3.Int.const(m.name);
          const evaluated = model.eval(c, true);
          retained.push(c, evaluated);
          values[m.name] = evaluated.toString();
        }
        results.push({ id: q.id, status: "sat", model: values });
      } else if (status === "unsat") {
        const coreVec = solver.unsatCore();
        retained.push(coreVec);
        const core: string[] = [];
        const len = typeof coreVec.length === "function" ? coreVec.length() : 0;
        for (let i = 0; i < len; i++) {
          // get(i) も個別の AST ラッパを生む——保持しないと後続クエリ中に
          // dec_ref が走りうる（レビュー指摘の取りこぼし）。
          const item = coreVec.get(i);
          retained.push(item);
          core.push(item.toString());
        }
        results.push({ id: q.id, status: "unsat", core: core.sort() });
      } else {
        results.push({ id: q.id, status: "unknown" });
      }
    } catch (err) {
      results.push({ id: q.id, status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  const out = `${JSON.stringify({ results })}\n`;
  // 保持はここまでで足りる——結果は素の JSON になっており、以後の解放順は
  // 観測面に影響しない。
  retained.length = 0;
  try {
    api.em.PThread.terminateAllThreads();
  } catch {
    // ベストエフォートのスレッド後始末——entry の exit が仕事を締める。
  }
  return out;
}
