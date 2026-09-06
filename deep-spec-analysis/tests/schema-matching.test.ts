import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { type Schema, validateSchema } from "@deep-spec-analysis/kernel-infrastructure";

test("小さな再帰式を3秒以内に検証する", () => {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      `
    import { readFileSync } from "node:fs";
    import { validateSchema } from "./src/kernel/infrastructure/schema.ts";
    const schema = JSON.parse(readFileSync("src/entries/data/deep-spec-design-ir-schema.json", "utf8"));
    let value = { op: "bool", value: true };
    for (let depth = 0; depth < 24; depth++) value = { args: [value], op: "not" };
    const errors = [];
    console.log(JSON.stringify({ valid: validateSchema(schema, { $ref: "#/definitions/expr" }, value, "", errors), errors }));
  `,
    ],
    { cwd: resolve(import.meta.dir, ".."), encoding: "utf8", timeout: 3000 },
  );
  expect(child.status).toBe(0);
  expect(JSON.parse(child.stdout)).toEqual({ valid: true, errors: [] });
});

test("候補照合を打ち切ってもoneOfの一致件数と公開診断の順序は維持する", () => {
  const root: Schema = {
    type: "object",
    required: ["missing"],
    properties: {
      a: { oneOf: [{ type: "integer" }, { type: "number" }] },
      b: { type: "string" },
    },
    additionalProperties: false,
  };
  const errors: string[] = [];
  expect(validateSchema(root, root, { a: 1, b: 2, extra: true }, "", errors)).toBe(false);
  expect(errors).toEqual([
    ': missing required property "missing"',
    "/a: matches 2 oneOf branches (must match exactly 1)",
    "/b: expected type string",
    ': unexpected property "extra"',
  ]);
});
