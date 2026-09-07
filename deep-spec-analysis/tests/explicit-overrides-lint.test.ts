import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { lintExplicitOverrides } from "../scripts/lint/explicit-overrides.ts";

const roots: string[] = [];
const typeRoots = resolve(import.meta.dir, "../node_modules/@types");

function project(files: Record<string, string>, noImplicitOverride = false): string {
  const root = mkdtempSync(join(tmpdir(), "explicit-overrides-lint-"));
  roots.push(root);
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        noImplicitOverride,
        allowImportingTsExtensions: true,
        typeRoots: [typeRoots],
        types: ["bun"],
      },
      include: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    }),
  );
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

test("noImplicitOverride leaves abstract implementations to this lint", async () => {
  const config = project(
    {
      "src/sample/domain/abstract-model.ts": `
        export abstract class Base<T> {
          abstract method(value: T): T;
          abstract field: T;
          abstract get value(): T;
          abstract set value(value: T);
        }
        export class Child extends Base<number> {
          method(value: number): number { return value; }
          field = 1;
          get value(): number { return this.field; }
          set value(value: number) { this.field = value; }
        }
      `,
    },
    true,
  );
  const result = await lintExplicitOverrides(config);
  expect(result.diagnostics.map(({ className, member, line }) => ({ className, member, line }))).toEqual([
    { className: "Child", member: "method", line: 9 },
    { className: "Child", member: "field", line: 10 },
    { className: "Child", member: "value", line: 11 },
    { className: "Child", member: "value", line: 12 },
  ]);
});

test("indirect generic inheritance covers instance, accessor, static and computed members", async () => {
  const config = project({
    "src/sample/domain/base.ts": `
      export abstract class Base<T> {
        method(value: T): T { return value; }
        field!: T;
        get value(): T { return this.field; }
        set value(value: T) { this.field = value; }
        static make(): Base<number> { throw new Error(); }
        static count = 1;
        [Symbol.iterator](): Iterator<T> { throw new Error(); }
      }
      export abstract class Mid<T> extends Base<T> {}
    `,
    "src/sample/domain/index.ts": 'export { Mid as Parent } from "./base.ts";',
    "src/sample/adapter/child.ts": `
      import { Parent } from "../domain/index.ts";
      export class Child extends Parent<number> {
        method(value: number): number { return value; }
        field = 1;
        get value(): number { return this.field; }
        set value(value: number) { this.field = value; }
        static make(): Child { return new Child(); }
        static count = 2;
        [Symbol.iterator](): Iterator<number> { return [][Symbol.iterator](); }
        fresh(): void {}
      }
      export interface Port { run(): void; value: string; }
      export class ImplementsOnly implements Port {
        run(): void {}
        value = "ok";
      }
    `,
  });
  const result = await lintExplicitOverrides(config);
  expect(result.diagnostics.map(({ className, member, line }) => ({ className, member, line }))).toEqual([
    { className: "Child", member: "method", line: 4 },
    { className: "Child", member: "field", line: 5 },
    { className: "Child", member: "value", line: 6 },
    { className: "Child", member: "value", line: 7 },
    { className: "Child", member: "make", line: 8 },
    { className: "Child", member: "count", line: 9 },
    { className: "Child", member: "[Symbol.iterator]", line: 10 },
  ]);
});

test("explicit overrides are clean, while implements-only and fresh members remain clean", async () => {
  const config = project({
    "src/sample/domain/base.ts": `
      export abstract class Base<T> {
        method(value: T): T { return value; }
        field!: T;
        get value(): T { return this.field; }
        set value(value: T) { this.field = value; }
        static make(): Base<number> { throw new Error(); }
        static count = 1;
        [Symbol.iterator](): Iterator<T> { throw new Error(); }
      }
    `,
    "src/sample/adapter/child.ts": `
      import { Base } from "../domain/base.ts";
      export class Child extends Base<number> {
        override method(value: number): number { return value; }
        override field = 1;
        override get value(): number { return this.field; }
        override set value(value: number) { this.field = value; }
        static override make(): Child { return new Child(); }
        static override count = 2;
        override [Symbol.iterator](): Iterator<number> { return [][Symbol.iterator](); }
        fresh(): void {}
      }
      export interface Port { run(): void; }
      export class ImplementsOnly implements Port { run(): void {} }
    `,
  });
  const result = await lintExplicitOverrides(config);
  expect(result.diagnostics).toEqual([]);
});

test("computed symbol identity, private fields, and anonymous class expressions use checker identity", async () => {
  const config = project({
    "src/sample/domain/base-key.ts": 'export const key: unique symbol = Symbol("base");\n',
    "src/sample/domain/other-key.ts": 'export const key: unique symbol = Symbol("other");\n',
    "src/sample/domain/base.ts": `
      import { key } from "./base-key.ts";
      export abstract class Base {
        #cache = 0;
        [key](): void {}
        method(): void {}
      }
    `,
    "src/sample/adapter/anonymous.ts": `
      import { key as sameKey } from "../domain/base-key.ts";
      import { key as differentKey } from "../domain/other-key.ts";
      import { Base } from "../domain/base.ts";
      export const Child = class extends Base {
        #cache = 1;
        [sameKey](): void {}
        [differentKey](): void {}
        method(): void {}
      };
    `,
  });
  const result = await lintExplicitOverrides(config);
  expect(result.diagnostics.map(({ className, member, line }) => ({ className, member, line }))).toEqual([
    { className: "<anonymous>", member: "[sameKey]", line: 7 },
    { className: "<anonymous>", member: "method", line: 9 },
  ]);
});

test("constructor parameter properties are override candidates and declare-only fields are excluded", async () => {
  const config = project(
    {
      "src/sample/domain/cases.ts": `
        export abstract class Base { abstract value: string; }
        export class ParamChild extends Base {
          constructor(public value: string) { super(); }
        }
        export class Parent { value: string | number = ""; }
        export class Refined extends Parent { declare value: string; }
      `,
    },
    true,
  );
  const result = await lintExplicitOverrides(config);
  expect(result.diagnostics.map(({ className, member, line }) => ({ className, member, line }))).toEqual([
    { className: "ParamChild", member: "value", line: 4 },
  ]);
});

test("CLI reports violations and exits 2 for syntax, type, and invalid override inputs", () => {
  const cli = resolve(import.meta.dir, "../scripts/lint-explicit-overrides.ts");
  const invalid = project({
    "src/sample/adapter/invalid.ts":
      "export class Base { method(): void {} } export class Child extends Base { method(): void {} }",
  });
  const failed = Bun.spawnSync(["bun", cli, "--project", invalid, "--json"]);
  expect(failed.exitCode).toBe(1);
  expect(JSON.parse(failed.stdout.toString()).diagnostics[0].rule).toBe("missing-override");
  const linkedRoot = mkdtempSync(join(tmpdir(), "explicit-overrides-link-"));
  roots.push(linkedRoot);
  const linked = join(linkedRoot, "tsconfig.json");
  symlinkSync(invalid, linked);
  const linkedRun = Bun.spawnSync(["bun", cli, "--project", linked, "--json"]);
  expect(linkedRun.exitCode).toBe(1);
  const syntax = project({ "src/sample/adapter/syntax.ts": "export class {" });
  const syntaxRun = Bun.spawnSync(["bun", cli, "--project", syntax, "--json"]);
  expect(syntaxRun.exitCode).toBe(2);
  const type = project({ "src/sample/adapter/type.ts": "export const value: string = 1;" });
  const typeRun = Bun.spawnSync(["bun", cli, "--project", type, "--json"]);
  expect(typeRun.exitCode).toBe(2);
  const invalidOverride = project({
    "src/sample/adapter/override.ts":
      "class Base { method(): void {} } class Child extends Base { override fresh(): void {} }",
  });
  const overrideRun = Bun.spawnSync(["bun", cli, "--project", invalidOverride, "--json"]);
  expect(overrideRun.exitCode).toBe(2);
});
