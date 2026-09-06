import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { ExpressionTree } from "../../../../../../../deep-spec-analysis/src/kernel/domain/index.ts";
import { type Schema, validateSchema } from "../../../../../../../deep-spec-analysis/src/kernel/infrastructure/index.ts";

type BooleanExpressionParam = { op: "bool"; value: boolean } | { op: "not"; args: BooleanExpressionParam[] };
const depth = Number(process.argv[2]);
let expression: BooleanExpressionParam = { op: "bool", value: true };
for (let n = 0; n < depth; n++) expression = { op: "not", args: [expression] };
const root = resolve(import.meta.dir, "../../../../../../..");
execFileSync("git", ["diff", "--exit-code", "90874c14037b73824372d2ca2ebb6bfe9beabb22", "--", "deep-spec-analysis/src"], { cwd: root });
const schema: Schema = JSON.parse(readFileSync(join(root, "deep-spec-analysis/src/entries/data/deep-spec-design-ir-schema.json"), "utf8"));
const began = performance.now();
const parsed = ExpressionTree.parse(expression);
console.log(JSON.stringify({ depth, nodes: depth + 1, bytes: Buffer.byteLength(JSON.stringify(expression)),
  expressionAccepted: parsed.ok, expressionMilliseconds: performance.now() - began }));
const errors: string[] = [];
const schemaBegan = performance.now();
const accepted = validateSchema(schema, { $ref: "#/definitions/expr" }, expression, "", errors);
console.log(JSON.stringify({ schemaAccepted: accepted, schemaMilliseconds: performance.now() - schemaBegan, errors }));
