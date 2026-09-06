import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { SatisfiabilityModuloTheoriesChildQuery } from "@deep-spec-analysis/requirements-adapter";

test("solver子プロセスが特殊な変数名をモデルのデータキーとして返す", () => {
  const query: SatisfiabilityModuloTheoriesChildQuery = {
    id: "special-keys",
    script: [
      "(declare-const __proto__ Bool)",
      "(declare-const constructor Bool)",
      "(declare-const ordinary Bool)",
      "(assert __proto__)",
      "(assert constructor)",
      "(assert (not ordinary))",
    ].join("\n"),
    assumptions: [],
    model: [
      { name: "__proto__", sort: "Bool" },
      { name: "constructor", sort: "Bool" },
      { name: "ordinary", sort: "Bool" },
    ],
  };
  const child = spawnSync(
    "node",
    [
      "--input-type=module",
      "--eval",
      'import { solveSmtChild } from "@deep-spec-analysis/requirements-adapter"; process.stdout.write(await solveSmtChild()); process.exit(0);',
    ],
    {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      input: JSON.stringify({ queries: [query], timeoutMs: 10_000, budgetMs: 30_000 }),
      encoding: "utf-8",
      timeout: 60_000,
    },
  );
  expect(child.error).toBeUndefined();
  expect(child.status).toBe(0);
  expect(JSON.parse(child.stdout)).toEqual({
    results: [
      {
        id: "special-keys",
        status: "sat",
        model: { ["__proto__"]: "true", constructor: "true", ordinary: "false" },
      },
    ],
  });
}, 60_000);
