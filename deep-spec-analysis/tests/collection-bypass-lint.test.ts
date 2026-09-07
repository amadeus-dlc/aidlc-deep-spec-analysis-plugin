import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type CollectionBypassExemption, lintCollectionBypass } from "../scripts/lint/collection-bypass.ts";

const roots: string[] = [];
const typeRoots = resolve(import.meta.dir, "../node_modules/@types");

// 共通契約の最小写し。リンターは宣言名で型を判定するので、この名前だけで足りる。
const CONTRACT = `
  export interface NonEmptyFirstClassCollection<E> extends Iterable<E> {
    head(): E;
    count(): number;
    exists(predicate: (element: E) => boolean): boolean;
    foldLeft<A>(initial: A, accumulate: (accumulator: A, element: E) => A): A;
  }
  export abstract class NonEmptyFirstClassCollectionBase<E> implements NonEmptyFirstClassCollection<E> {
    abstract [Symbol.iterator](): Iterator<E>;
    head(): E {
      for (const element of this) return element;
      throw new Error("empty");
    }
    count(): number {
      let total = 0;
      for (const _element of this) total++;
      return total;
    }
    exists(predicate: (element: E) => boolean): boolean {
      for (const element of this) if (predicate(element)) return true;
      return false;
    }
    foldLeft<A>(initial: A, accumulate: (accumulator: A, element: E) => A): A {
      let accumulator = initial;
      for (const element of this) accumulator = accumulate(accumulator, element);
      return accumulator;
    }
  }
  export class Names extends NonEmptyFirstClassCollectionBase<string> {
    readonly #values: readonly string[];
    private constructor(values: readonly string[]) {
      super();
      this.#values = values;
    }
    static of(values: readonly string[]): Names {
      return new Names(values);
    }
    override *[Symbol.iterator](): Iterator<string> {
      yield* this.#values;
    }
    toArray(): readonly string[] {
      return [...this.#values];
    }
  }
`;

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "collection-bypass-lint-"));
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
        allowImportingTsExtensions: true,
        typeRoots: [typeRoots],
        types: ["bun"],
      },
      include: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    }),
  );
  for (const [path, content] of Object.entries({ "src/kernel/domain/contract.ts": CONTRACT, ...files })) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return join(root, "tsconfig.json");
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("each way of leaving the collection contract is reported once", async () => {
  const config = project({
    "src/sample/domain/consumer.ts": `
      import { Names } from "../../kernel/domain/contract.ts";
      export function joined(names: Names): string {
        let text = "";
        for (const name of names) text += name;
        return text;
      }
      export function copied(names: Names): readonly string[] {
        return [...names];
      }
      export function converted(names: Names): readonly string[] {
        return Array.from(names);
      }
      export function escaped(names: Names): readonly string[] {
        return names.toArray();
      }
    `,
  });
  const result = await lintCollectionBypass(config, []);
  expect(result.diagnostics.map(({ rule, line }) => ({ rule, line }))).toEqual([
    { rule: "for-of-traversal", line: 5 },
    { rule: "spread-materialization", line: 9 },
    { rule: "array-from", line: 12 },
    { rule: "to-array", line: 15 },
  ]);
});

test("the contract's own operations and unrelated iterables stay clean", async () => {
  const config = project({
    "src/sample/domain/clean.ts": `
      import { Names } from "../../kernel/domain/contract.ts";
      export function summarized(names: Names): string {
        return names.foldLeft("", (accumulator, name) => accumulator + name);
      }
      export function sized(names: Names): number {
        return names.count();
      }
      export function present(names: Names): boolean {
        return names.exists((name) => name === "a");
      }
      export function overArray(values: readonly string[]): string {
        let text = "";
        for (const value of values) text += value;
        return text + [...values].join("") + Array.from(values).join("");
      }
      export function overSet(values: Set<string>): string {
        let text = "";
        for (const value of values) text += value;
        return text;
      }
      export function overMap(values: Map<string, string>): number {
        return Array.from(values).length;
      }
    `,
  });
  const result = await lintCollectionBypass(config, []);
  expect(result.diagnostics).toEqual([]);
});

test("a collection's own body may iterate and materialize", async () => {
  const config = project({
    "src/sample/domain/own-body.ts": `
      import { NonEmptyFirstClassCollectionBase } from "../../kernel/domain/contract.ts";
      export class Tags extends NonEmptyFirstClassCollectionBase<string> {
        readonly #values: readonly string[];
        private constructor(values: readonly string[]) {
          super();
          this.#values = values;
        }
        static of(values: readonly string[]): Tags {
          return new Tags(values);
        }
        override *[Symbol.iterator](): Iterator<string> {
          yield* this.#values;
        }
        merged(other: Tags): Tags {
          return Tags.of([...this, ...other]);
        }
        toArray(): readonly string[] {
          return Array.from(this);
        }
      }
    `,
  });
  const result = await lintCollectionBypass(config, []);
  expect(result.diagnostics).toEqual([]);
});

test("translating at the boundary is the adapter's and the composition root's duty", async () => {
  // 同じ 3 つの迂回を各層へ置き、層だけが判定を分けることを示す。
  const consumer = (prefix: string): string => `
      import { Names } from "${prefix}/kernel/domain/contract.ts";
      export function escaped(names: Names): readonly string[] {
        return names.toArray();
      }
      export function copied(names: Names): readonly string[] {
        return [...names];
      }
      export function joined(names: Names): string {
        let text = "";
        for (const name of names) text += name;
        return text;
      }
    `;
  const config = project({
    "src/sample/adapter/renderer.ts": consumer("../.."),
    "src/entries/tool.ts": consumer(".."),
    "src/sample/domain/model.ts": consumer("../.."),
    "src/sample/usecase/interactor.ts": consumer("../.."),
    "src/kernel/infrastructure/support.ts": consumer("../.."),
  });
  const result = await lintCollectionBypass(config, []);
  expect(result.diagnostics.map(({ rule, path }) => ({ rule, path }))).toEqual([
    { rule: "to-array", path: "src/kernel/infrastructure/support.ts" },
    { rule: "spread-materialization", path: "src/kernel/infrastructure/support.ts" },
    { rule: "for-of-traversal", path: "src/kernel/infrastructure/support.ts" },
    { rule: "to-array", path: "src/sample/domain/model.ts" },
    { rule: "spread-materialization", path: "src/sample/domain/model.ts" },
    { rule: "for-of-traversal", path: "src/sample/domain/model.ts" },
    { rule: "to-array", path: "src/sample/usecase/interactor.ts" },
    { rule: "spread-materialization", path: "src/sample/usecase/interactor.ts" },
    { rule: "for-of-traversal", path: "src/sample/usecase/interactor.ts" },
  ]);
});

test("tests and scripts are outside every rule so they can exercise the public surface", async () => {
  const config = project({
    "tests/surface.test.ts": `
      import { Names } from "../src/kernel/domain/contract.ts";
      const names = Names.of(["a"]);
      export const first = [...names][0];
      export const all = names.toArray();
    `,
    "scripts/report.ts": `
      import { Names } from "../src/kernel/domain/contract.ts";
      export function dump(names: Names): readonly string[] {
        return Array.from(names);
      }
    `,
  });
  const result = await lintCollectionBypass(config, []);
  expect(result.diagnostics).toEqual([]);
});

test("the exemption table absorbs exactly what it declares and no more", async () => {
  const config = project({
    "src/sample/domain/consumer.ts": `
      import { Names } from "../../kernel/domain/contract.ts";
      export function joined(names: Names): string {
        let text = "";
        for (const name of names) text += name;
        return text;
      }
      export function counted(names: Names): number {
        let total = 0;
        for (const _name of names) total++;
        return total;
      }
      export function copied(names: Names): readonly string[] {
        return [...names];
      }
    `,
  });
  const exemption = (count: number): CollectionBypassExemption[] => [
    {
      path: "src/sample/domain/consumer.ts",
      rule: "for-of-traversal",
      count,
      reason: "1 周で複数の蓄積器へ書く",
    },
  ];

  // 表が許す件数までは落ち、超えた分と別規則は残る。
  expect(
    (await lintCollectionBypass(config, exemption(1))).diagnostics.map(({ rule, line }) => ({ rule, line })),
  ).toEqual([
    { rule: "for-of-traversal", line: 10 },
    { rule: "spread-materialization", line: 14 },
  ]);
  expect((await lintCollectionBypass(config, exemption(2))).diagnostics.map(({ rule }) => rule)).toEqual([
    "spread-materialization",
  ]);
});

test("an exemption that outlives its violations is reported as stale", async () => {
  const config = project({
    "src/sample/domain/clean.ts": `
      import { Names } from "../../kernel/domain/contract.ts";
      export function sized(names: Names): number {
        return names.count();
      }
    `,
  });
  const result = await lintCollectionBypass(config, [
    { path: "src/sample/domain/clean.ts", rule: "for-of-traversal", count: 2, reason: "もう無い迂回" },
  ]);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]?.excerpt).toContain("免除表が 2 件多く免除しています");
});
