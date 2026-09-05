import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type GetterLintReport, lintUsecaseGetters } from "../scripts/lint/usecase-getters.ts";

const roots: string[] = [];
const model = `
export class Token {
  readonly #value: string;
  constructor(value: string) { this.#value = value; }
  asString(): string { return this.#value; }
}
export class Model {
  readonly #token = new Token("a");
  readonly #items = [1, 2];
  readonly #bytes = new Uint8Array([1, 2]);
  readonly #version = "1.0.0";
  readonly #flag = true;
  hash(): Token { return this.#token; }
  renamedGetter(): Token { const result = this.#token; return result; }
  forwarded(): string { return this.hash().asString(); }
  count(): number { return this.#items.length; }
  bytes(): Uint8Array { return new Uint8Array(this.#bytes); }
  snapshot(): number[] { return structuredClone(this.#items); }
  values(): readonly number[] { return [...this.#items]; }
  majorVersion(): number { return Number.parseInt(this.#version.split(".")[0] ?? "", 10); }
  flag(): boolean { return this.#flag; }
  guarded(present: boolean): Token | null { if (!present) return null; return this.#token; }
  get current(): Token { return this.#token; }
  isEmpty(): boolean { return this.#items.length === 0; }
  supportsMajor(major: number): boolean { return this.majorVersion() === major; }
  passes(): boolean { return this.isEmpty(); }
  lowered(): Model { return new Model(); }
  interpret(): Model { for (const value of this.#items) { if (value > 0) return new Model(); } return new Model(); }
  dispatch<T>(cases: {empty: () => T; nonempty: () => T}): T { return this.isEmpty() ? cases.empty() : cases.nonempty(); }
  cycleA(): Token { return this.cycleB(); }
  cycleB(): Token { return this.cycleA(); }
}
export class DerivedModel extends Model {}
`;

function project(source: string, extraMember = ""): string {
  const root = mkdtempSync(join(tmpdir(), "usecase-getter-lint-"));
  roots.push(root);
  const files = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        allowImportingTsExtensions: true,
      },
      include: ["src/**/*.ts"],
    }),
    "src/sample/domain/model.ts": model.replace("  cycleA():", `${extraMember}\n  cycleA():`),
    "src/sample/domain/index.ts": 'export { Model as Aggregate, DerivedModel } from "./model.ts";',
    "src/kernel/infrastructure/result-success.ts":
      "export interface ResultSuccess<T> { readonly ok: true; readonly value: T; }",
    "src/sample/usecase/port/client.ts": "export interface Client { hash(): string; interpret(): void; }",
    "src/sample/usecase/example.ts": `import { Aggregate, DerivedModel } from "../domain/index.ts";\nimport type { ResultSuccess } from "../../kernel/infrastructure/result-success.ts";\nimport type { Client } from "./port/client.ts";\n${source}`,
    "src/sample/adapter/presenter.ts":
      'import { Model } from "../domain/model.ts"; export const render = (model: Model) => model.hash().asString();',
  };
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return join(root, "tsconfig.json");
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("domain getters in usecases are resolved by declaration", () => {
  let result: GetterLintReport;
  beforeAll(async () => {
    result = await lintUsecaseGetters(
      project(`
      export function execute(model: Aggregate, maybe: Aggregate | undefined, derived: DerivedModel) {
        model.hash(); model.renamedGetter(); model.forwarded(); model.count();
        model.bytes(); model.snapshot(); model.values(); model.majorVersion(); model.flag(); model.guarded(true);
        model.current;
        model["hash"](); const key = "hash"; model[key](); maybe?.hash(); derived.hash();
        const alias = model.hash; alias();
        const { hash: extracted } = model; extracted();
        model.hash.call(model); model.hash.apply(model); const bound = model.hash.bind(model); bound();
        [1].map(() => model.hash());
      }
    `),
    );
  });

  test("a VO result, local alias, conversion relay and derived count remain getters", () => {
    const members = new Set(result.diagnostics.map((issue) => issue.member));
    for (const name of [
      "hash",
      "renamedGetter",
      "forwarded",
      "count",
      "bytes",
      "snapshot",
      "values",
      "majorVersion",
      "flag",
      "guarded",
      "current",
    ]) {
      expect(members.has(`Model.${name}`)).toBe(true);
    }
    expect(result.diagnostics.filter((issue) => issue.rule !== "usecase-domain-getter")).toEqual([]);
  });

  test("aliases, inheritance, computed access, optional calls, callbacks and call/apply/bind retain their owner", () => {
    const hashes = result.diagnostics.filter((issue) => issue.member === "Model.hash");
    expect(hashes).toHaveLength(14);
    expect(hashes.every((issue) => issue.declaration === "src/sample/domain/model.ts")).toBe(true);
    expect(hashes.every((issue) => issue.line > 0 && issue.column > 0 && issue.declarationLine > 0)).toBe(true);
  });

  test("adapter conversions are outside the prohibition", () => {
    expect(result.checkedFiles).toBe(2);
    expect(result.diagnostics.every((issue) => issue.path.includes("/usecase/"))).toBe(true);
  });
});

test("semantic predicates, domain operations, ports and unrelated same-name methods are allowed", async () => {
  const result = await lintUsecaseGetters(
    project(`
    export function execute(model: Aggregate, client: Client) {
      model.isEmpty(); model.supportsMajor(1); model.passes(); model.lowered(); model.interpret();
      model.dispatch({empty: () => 1, nonempty: () => 2});
      client.hash(); client.interpret();
      const unrelated = {hash: () => "x", value: "x"}; unrelated.hash();
      // model.hash() in a comment is not an access.
      return "model.hash()" + unrelated.value;
    }
  `),
  );
  expect(result.diagnostics).toEqual([]);
});

test("Result value extraction is a separate rule; ok control flow remains allowed", async () => {
  const result = await lintUsecaseGetters(
    project(`
    export function execute(acquired: ResultSuccess<Aggregate>) {
      if (acquired.ok) { acquired.value; acquired["value"]; const { value } = acquired; return value; }
    }
  `),
  );
  expect(result.diagnostics.map((issue) => issue.rule)).toEqual(Array(3).fill("usecase-result-unwrapping"));
});

test("a getter extracted with a computed key cannot escape through bind", async () => {
  const result = await lintUsecaseGetters(
    project(`
    export function execute(model: Aggregate) {
      const key = "hash";
      return model[key].bind(model);
    }
  `),
  );
  expect(result.diagnostics.map((issue) => issue.member)).toEqual(["Model.hash"]);
});

test("cyclic getter delegation is reported as unclassified, never silently accepted", async () => {
  const result = await lintUsecaseGetters(project("export const execute = (model: Aggregate) => model.cycleA();"));
  expect(result.diagnostics.map((issue) => issue.rule)).toEqual(["unclassified-domain-access"]);
});

describe("reviewed bypasses never produce a clean lint result", () => {
  const cases = [
    { name: "any erasure", source: "const erased: any = model; erased.hash();" },
    {
      name: "structural projection",
      source: 'const view: {hash(): ReturnType<Aggregate["hash"]>} = model; view.hash();',
    },
    { name: "suppressed missing member", source: "// @ts-ignore\nmodel.missing();" },
    { name: "computed destructuring", source: 'const key = "hash"; const {[key]: getter} = model; return getter;' },
    {
      name: "union key and bind",
      source: 'const key = Math.random() > 0.5 ? "hash" : "renamedGetter"; return model[key].bind(model);',
    },
    { name: "mutable alias", member: 'leak(): string { let value = ""; value = this.#version; return value; }' },
    {
      name: "copy loop",
      member:
        "leak(): number[] { const values: number[] = []; for (const value of this.#items) values.push(value); return values; }",
    },
    { name: "destructured alias", member: "leak(): string { const {value} = {value: this.#version}; return value; }" },
    { name: "generator", member: "*leak(): IterableIterator<number> { yield* this.#items; }" },
    { name: "fallback", member: 'leak(): string { return this.#version || ""; }' },
    { name: "boolean conversion", member: "leak(): boolean { return Boolean(this.#flag); }" },
    {
      name: "mixed returns",
      member: "leak(flag = true): Token | Model { if (flag) return this.#token; return new Model(); }",
    },
    {
      name: "identity helper",
      member:
        "leak(): string { return this.identity(this.#version); } identity(value: string): string { return value; }",
    },
  ];
  for (const example of cases) {
    test(example.name, async () => {
      const result = await lintUsecaseGetters(
        project(`export function execute(model: Aggregate) { ${example.source ?? "model.leak();"} }`, example.member),
      );
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.every((issue) => issue.path === "src/sample/usecase/example.ts")).toBe(true);
    });
  }
});

test("an arrow function property can be a domain operation", async () => {
  const result = await lintUsecaseGetters(
    project(
      "export const execute = (model: Aggregate) => model.arrowOperation();",
      "readonly arrowOperation = (): Model => new Model();",
    ),
  );
  expect(result.diagnostics).toEqual([]);
});

test("domain operations may retain an input result or accumulate immutable domain results", async () => {
  const result = await lintUsecaseGetters(
    project(
      "export function execute(model: Aggregate) { model.retained(model); model.accumulated(model); }",
      `retained(result: Model): Model { if (this.isEmpty()) return result; return result.lowered(); }
     accumulated(report: Model): Model { let result = report; result = result.lowered(); return result; }`,
    ),
  );
  expect(result.diagnostics).toEqual([]);
});

test("a domain-typed helper parameter does not disguise private state extraction", async () => {
  const result = await lintUsecaseGetters(
    project(
      "export const execute = (model: Aggregate) => model.forwardedPrivate();",
      "forwardedPrivate(): Token { return this.identityToken(this.#token); } identityToken(value: Token): Token { return value; }",
    ),
  );
  expect(result.diagnostics.map((issue) => issue.rule)).toEqual(["usecase-domain-getter"]);
});

test("reassigning a domain accumulator from private state remains unclassified", async () => {
  const result = await lintUsecaseGetters(
    project(
      "export const execute = (model: Aggregate) => model.reassigned();",
      "reassigned(): Token { let value = new Token('public'); value = this.#token; return value; }",
    ),
  );
  expect(result.diagnostics.map((issue) => issue.rule)).toEqual(["unclassified-domain-access"]);
});

test("a type error in the domain also prevents a clean result", async () => {
  await expect(
    lintUsecaseGetters(
      project(
        "export const execute = (model: Aggregate) => model.brokenOperation();",
        "brokenOperation(): Model { missingFunction(); return new Model(); }",
      ),
    ),
  ).rejects.toThrow("TypeScript source has");
});

test("type errors prevent a misleading clean lint result", async () => {
  await expect(
    lintUsecaseGetters(project("export const execute = (model: Aggregate) => model.missing();")),
  ).rejects.toThrow("TypeScript source has");
});

test("CLI exits 0 for clean code, 1 for violations, and 2 for invalid input", () => {
  const cli = resolve(import.meta.dir, "../scripts/lint-usecase-getters.ts");
  const clean = project("export const execute = (model: Aggregate) => model.lowered();");
  const invalid = project("export const execute = (model: Aggregate) => model.hash();");
  const cleanRun = Bun.spawnSync(["bun", cli, "--project", clean, "--json"]);
  expect(cleanRun.exitCode).toBe(0);
  expect(JSON.parse(cleanRun.stdout.toString()).diagnostics).toEqual([]);
  const failed = Bun.spawnSync(["bun", cli, "--project", invalid, "--json"]);
  expect(failed.exitCode).toBe(1);
  expect(JSON.parse(failed.stdout.toString()).diagnostics[0].member).toBe("Model.hash");
  expect(Bun.spawnSync(["bun", cli, "--project"]).exitCode).toBe(2);
});
