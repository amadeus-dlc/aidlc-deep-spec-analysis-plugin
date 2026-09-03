// アーキテクチャテスト（issue #13 骨格 → PR10 で allowlist 空化）。
//
// 二段構え:
//   1. red/green example — 各ルールが違反を実際に検出できることを、実ツリーへ
//      適用する前にインラインの fixture ソースで証明する（カスタム検査の DoD:
//      検出力の証明なきルールはそれ自体がレビュー指摘）。
//   2. 実ツリー走査 — tools/ 配下の全 .ts を走査し違反ゼロを表明する。
//      旧 LEGACY_FILES 免除は PR10 で空化済み——フラットに残るのは合成ルート
//      (entry)の 10 ファイルだけで、それ以外の未分類ファイルは違反になる。

import { describe, expect, test } from "bun:test";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENTRY_FILES,
  layerDirection,
  locationOf,
  noEntryImports,
  noEnums,
  noExportStar,
  noGetAccessors,
  noIoInPureLayers,
  noNonNullAssertions,
  onePublicTypePerFile,
  portsLiveInPortDir,
  commandsReturnVoid,
  noDataModelsInDomain,
  noPrimitiveFieldsInDomain,
  primitiveFieldsOf,
  PUBLISHED_LANGUAGE,
  domainFieldsArePrivate,
  publishedLanguageLayers,
  noTestPayloads,
  onlySanctionedImports,
  privateConstructorInDomain,
  processOnlyInEntries,
  violationsOf,
} from "./architecture/rules.ts";

const toolsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tools");

function walkToolsFiles(dir = toolsDir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    const stat = lstatSync(p);
    expect(stat.isSymbolicLink()).toBe(false);
    if (stat.isDirectory()) out.push(...walkToolsFiles(p));
    else if (entry.endsWith(".ts")) out.push(relative(toolsDir, p));
  }
  return out;
}

describe("rule red/green examples (detection power proof)", () => {
  test("no-test-payloads flags a test file and a fixtures directory, passes a plain module", () => {
    expect(noTestPayloads("kernel/domain/digest.test.ts", "")).not.toHaveLength(0);
    expect(noTestPayloads("kernel/fixtures/x.ts", "")).not.toHaveLength(0);
    expect(noTestPayloads("kernel/domain/digest.ts", "")).toHaveLength(0);
  });

  test("only-sanctioned-imports flags an npm import, passes node:/relative/z3-solver", () => {
    expect(onlySanctionedImports("kernel/domain/x.ts", 'import { z } from "zod";')).not.toHaveLength(0);
    expect(
      onlySanctionedImports(
        "kernel/domain/x.ts",
        'import { createHash } from "node:crypto";\nimport { y } from "./y.ts";\nconst m = await import("z3-solver");',
      ),
    ).toHaveLength(0);
  });

  test("a string literal containing the word from is not mistaken for an import", () => {
    expect(onlySanctionedImports("kernel/domain/x.ts", 'const detail = `enum mapping from "${src}" is not total`;')).toHaveLength(0);
  });

  test("a dynamic import with a non-literal argument is flagged (template literal and concatenation)", () => {
    expect(onlySanctionedImports("kernel/adapter/x.ts", "const m = await import(`zod`);")).not.toHaveLength(0);
    expect(onlySanctionedImports("kernel/adapter/x.ts", 'const m = await import("./" + name);')).not.toHaveLength(0);
    expect(onlySanctionedImports("kernel/adapter/x.ts", 'const m = await import("z3-solver");')).toHaveLength(0);
  });

  test("no-entry-imports flags an import of a composition root", () => {
    expect(noEntryImports("kernel/adapter/x.ts", 'import { m } from "../../aidlc-sensor-deep-spec-ir-valid.ts";')).not.toHaveLength(0);
    expect(noEntryImports("kernel/adapter/x.ts", 'import { m } from "./y.ts";')).toHaveLength(0);
  });

  test("no-io-in-pure-layers flags node:fs in domain and child_process in usecase, allows node:crypto in domain", () => {
    expect(noIoInPureLayers("kernel/domain/x.ts", 'import { readFileSync } from "node:fs";')).not.toHaveLength(0);
    expect(noIoInPureLayers("design/usecase/x.ts", 'import { spawnSync } from "node:child_process";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/domain/digest.ts", 'import { createHash } from "node:crypto";')).toHaveLength(0);
    expect(noIoInPureLayers("kernel/adapter/x.ts", 'import { readFileSync } from "node:fs";')).toHaveLength(0);
  });

  test("a node:fs subpath does not slip past the usecase ban", () => {
    expect(noIoInPureLayers("design/usecase/x.ts", 'import { readFile } from "node:fs/promises";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/domain/x.ts", 'import { readFile } from "node:fs/promises";')).not.toHaveLength(0);
  });

  test("infrastructure is a pure language extension: every node import is flagged, even node:crypto", () => {
    expect(noIoInPureLayers("kernel/infrastructure/x.ts", 'import { createHash } from "node:crypto";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/infrastructure/x.ts", 'import { readFileSync } from "node:fs";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/infrastructure/result.ts", "export const ok = 1;")).toHaveLength(0);
  });

  test("bare node builtins do not slip past the IO discipline (normalized to node:)", () => {
    expect(noIoInPureLayers("kernel/infrastructure/x.ts", 'import { createHash } from "crypto";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/domain/x.ts", 'import { readFileSync } from "fs";')).not.toHaveLength(0);
    expect(noIoInPureLayers("design/usecase/x.ts", 'import { readFile } from "fs/promises";')).not.toHaveLength(0);
    expect(noIoInPureLayers("kernel/domain/x.ts", 'import { createHash } from "crypto";')).toHaveLength(0);
  });

  test("process-only-in-entries flags process.env and import.meta in layered files", () => {
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const v = process.env.X;")).not.toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const p = import.meta.url;")).not.toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const v = 1;")).toHaveLength(0);
  });

  test("a // inside a string literal does not hide the rest of the line from the rules", () => {
    expect(processOnlyInEntries("kernel/adapter/x.ts", 'const s = "x//y"; process.env.X;')).not.toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", "const s = `a//b`; const p = import.meta.url;")).not.toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", 'const url = "https://example.com";')).toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", 'const esc = "quote:\\" // still string"; process.exit(1);')).not.toHaveLength(0);
  });

  test("a comment mentioning process or import.meta or export * is not a violation", () => {
    expect(processOnlyInEntries("kernel/adapter/x.ts", "// process.argv は entry の責務\nconst v = 1;")).toHaveLength(0);
    expect(processOnlyInEntries("kernel/adapter/x.ts", "/* import.meta を触らない */\nconst v = 1;")).toHaveLength(0);
    expect(noExportStar("kernel/domain/index.ts", '// export * は禁止\nexport { X } from "./x.ts";')).toHaveLength(0);
    expect(onlySanctionedImports("kernel/domain/x.ts", '// import { z } from "zod"; と書いてはならない\nconst v = 1;')).toHaveLength(0);
  });

  test("private-constructor-in-domain flags a public-ctor domain class, passes factories and Error types", () => {
    expect(privateConstructorInDomain("kernel/domain/x.ts", "export class Token {\n  constructor(v: string) {}\n}")).not.toHaveLength(0);
    expect(privateConstructorInDomain("kernel/domain/x.ts", "export class Token {\n  private constructor(v: string) {}\n  static of(v: string): Token { return new Token(v); }\n}")).toHaveLength(0);
    expect(privateConstructorInDomain("kernel/domain/x.ts", "export class Boom extends Error {\n  constructor(m: string) { super(m); }\n}")).toHaveLength(0);
    // adapter のクラスは対象外(Impl は合成ルートが new で配線する)。
    expect(privateConstructorInDomain("kernel/adapter/x.ts", "export class Impl {\n  constructor() {}\n}")).toHaveLength(0);
  });

  test("no-get-accessors flags a getter, passes a method and a string mentioning get", () => {
    expect(noGetAccessors("kernel/domain/x.ts", "export class A {\n  get value(): string { return this.#v; }\n}")).not.toHaveLength(0);
    expect(noGetAccessors("kernel/domain/x.ts", "export class A {\n  value(): string { return this.#v; }\n}")).toHaveLength(0);
    expect(noGetAccessors("kernel/domain/x.ts", 'const s = "  get thing (";\nconst v = 1;')).toHaveLength(0);
  });

  test("no-enums flags enum declarations, passes literal unions and the word in prose", () => {
    expect(noEnums("kernel/domain/x.ts", "export enum Kind { A, B }")).not.toHaveLength(0);
    expect(noEnums("kernel/domain/x.ts", "const enum Kind { A }")).not.toHaveLength(0);
    expect(noEnums("kernel/domain/x.ts", 'type Kind = "a" | "b";')).toHaveLength(0);
    expect(noEnums("kernel/domain/x.ts", '// enum は禁止\nconst v = "enum Kind {";')).toHaveLength(0);
  });

  test("no-non-null-assertions flags x! forms, passes negation and inequality", () => {
    expect(noNonNullAssertions("kernel/domain/x.ts", "const v = xs[0]!.name;")).not.toHaveLength(0);
    expect(noNonNullAssertions("kernel/domain/x.ts", "const v = find()!;")).not.toHaveLength(0);
    expect(noNonNullAssertions("kernel/domain/x.ts", "const v = m!.group;")).not.toHaveLength(0);
    expect(noNonNullAssertions("kernel/domain/x.ts", "if (a !== b && !flag && a != c) { run(); }")).toHaveLength(0);
    expect(noNonNullAssertions("kernel/domain/x.ts", 'const s = "bang! inside string";')).toHaveLength(0);
  });

  test("one-public-type-per-file flags multi-type files, name mismatches, facade/entry declarations", () => {
    expect(onePublicTypePerFile("kernel/domain/token.ts", "export class Token {}\nexport class TokenError {}")).not.toHaveLength(0);
    expect(onePublicTypePerFile("kernel/domain/token.ts", "export class Token {}\ntype TokenError = { raw: string };")).toHaveLength(0);
    expect(onePublicTypePerFile("kernel/domain/wrong-name.ts", "export class Token {}")).not.toHaveLength(0);
    expect(onePublicTypePerFile("kernel/domain/trigger-name.ts", "export class TriggerName {}")).toHaveLength(0);
    expect(onePublicTypePerFile("kernel/usecase/verify-usecase.ts", "export class VerifyUseCase {}")).toHaveLength(0);
    expect(onePublicTypePerFile("kernel/domain/index.ts", "export class Sneaky {}")).not.toHaveLength(0);
    expect(onePublicTypePerFile("kernel/domain/index.ts", 'export { Token } from "./token.ts";')).toHaveLength(0);
    expect(onePublicTypePerFile("aidlc-sensor-deep-spec-ir-valid.ts", "export type Verdict = { pass: boolean };")).not.toHaveLength(0);
    expect(onePublicTypePerFile("kernel/domain/token.ts", 'const s = "export class Fake {}";\nexport class Token {}')).toHaveLength(0);
  });

  test("ports-live-in-port-dir flags a stray port contract and an interactor inside port/", () => {
    expect(portsLiveInPortDir("design/usecase/foo-repository.ts", "export interface FooRepository { x(): void }")).not.toHaveLength(0);
    expect(portsLiveInPortDir("design/usecase/foo-client.ts", "export interface FooClient { x(): void }")).not.toHaveLength(0);
    expect(portsLiveInPortDir("design/usecase/port/foo-repository.ts", "export interface FooRepository { x(): void }")).toHaveLength(0);
    expect(portsLiveInPortDir("design/usecase/port/sneaky.ts", "export class Sneaky {}")).not.toHaveLength(0);
    expect(portsLiveInPortDir("design/usecase/verify-usecase.ts", "export class VerifyUseCase {}")).toHaveLength(0);
    expect(portsLiveInPortDir("design/adapter/foo-client-config.ts", "export interface FooClientConfig { y: string }")).toHaveLength(0);
  });

  test("commands-return-void flags a store that returns the aggregate", () => {
    expect(commandsReturnVoid("design/usecase/port/foo-repository.ts", "export interface FooRepository {\n  store(x: Foo): Result<Foo, RepositoryError>;\n}")).not.toHaveLength(0);
    expect(commandsReturnVoid("design/usecase/port/foo-repository.ts", "export interface FooRepository {\n  store(x: Foo): Result<void, RepositoryError>;\n}")).toHaveLength(0);
    expect(commandsReturnVoid("design/usecase/foo-usecase.ts", "store(x: Foo): Result<Foo, RepositoryError>;")).toHaveLength(0);
  });

  test("no-data-models-in-domain flags getter-only shapes outside the debt set", () => {
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo {\n  readonly a: string;\n}")).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo {\n  judge(): boolean;\n}")).toHaveLength(0);
    // #80: メソッドを添えてもプロパティが 1 つでもあればデータモデル（「メソッドが一つあれば合格」の抜け道を塞ぐ）。
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo {\n  readonly a: string;\n  judge(): boolean;\n}")).toHaveLength(1);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo {\n  judge(): boolean;\n  on: () => void;\n}")).toHaveLength(1);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo {\n  judge(): boolean;\n  readonly [k: string]: string;\n}")).toHaveLength(1);
    // 公開言語の表の項目だけが免除——表のパスにある表の名前で、別名は免除されない。
    expect(noDataModelsInDomain("kernel/domain/expression.ts", "export interface Expression {\n  readonly op: string;\n}")).toHaveLength(0);
    expect(noDataModelsInDomain("kernel/domain/expression.ts", "export interface Sneak {\n  readonly op: string;\n}")).toHaveLength(1);
    expect(noDataModelsInDomain("design/domain/expression.ts", "export interface Expression {\n  readonly op: string;\n}")).toHaveLength(1);
    // 型引数付き interface も data model（波39 で塞いだ穴）——ネストした型引数と
    // extends 節を経由しても回避できない。
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo<T> {\n  readonly t: T;\n}")).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo<T extends Promise<string>> {\n  readonly t: T;\n}")).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo<T extends Map<string, Set<number>>> {\n  readonly t: T;\n}")).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo<T extends Promise<string>> extends Bar<T> {\n  readonly t: T;\n}")).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", "export interface Foo<T extends Promise<string>> {\n  judge(t: T): boolean;\n}")).toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo = { a: string };\n')).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo = { kind: "a" } | { kind: "b" };\n')).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo = "a" | "b";\n')).toHaveLength(0);
    // ジェネリック别名と末尾セミコロン省略も検出する（波3レビュー指摘の回帰）。
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo<T> = { t: T };\n')).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo = { a: string }\n')).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo = { kind: "a" } | { kind: "b" }\n')).not.toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo<T> = T | T[];\n')).toHaveLength(0);
    expect(noDataModelsInDomain("design/domain/foo.ts", 'export type Foo = "a" | "b"\n')).toHaveLength(0);
    expect(noDataModelsInDomain("design/adapter/foo.ts", "export interface Foo {\n  readonly a: string;\n}")).toHaveLength(0);
  });

  test("no-primitive-fields-in-domain flags string/number fields outside the debt set", () => {
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", "export class Foo {\n  readonly #name: string;\n  readonly #ok: boolean;\n}")).toHaveLength(1);
    // 初期化子つき（型注釈あり／なし）、definite assignment `!`、無インデントでも検出する（レビュー指摘の回帰）。
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", 'export class Foo {\n  readonly #name: string = "x";\n  #count = 0;\n  #code = "";\n  #set = new Set<string>();\n}').map((v) => v.detail)).toEqual([
      "primitive-typed field #name: string — wrap it in a domain primitive or keep it behind a DP door",
      "primitive-typed field #count: number — wrap it in a domain primitive or keep it behind a DP door",
      "primitive-typed field #code: string — wrap it in a domain primitive or keep it behind a DP door",
    ]);
    expect(primitiveFieldsOf("export class Foo {\n#name: string;\n  #count!: number;\n  static #n: number;\n}")).toEqual(["#name: string", "#count: number", "#n: number"]);
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", "export class Foo {\n  readonly #ids: ReadonlySet<string>;\n  readonly #count: number;\n  readonly #byId: ReadonlyMap<string, Foo>;\n}")).toHaveLength(3);
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", "export interface Foo {\n  readonly count: number;\n  readonly flag: boolean;\n  readonly names?: readonly string[];\n}")).toHaveLength(2);
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", 'export type Foo =\n  | { readonly kind: "a"; readonly core: string[] }\n  | { readonly kind: "b" };\n')).toHaveLength(1);
    // 裁定の除外: DP ラッパー(唯一の #value)、bool、prose、state トークン、
    // literal union、index signature、メソッド署名、除外ファイル、台帳、domain 以外。
    expect(noPrimitiveFieldsInDomain("design/domain/foo-id.ts", "export class FooId {\n  readonly #value: string;\n}")).toHaveLength(0);
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", 'export class Foo {\n  readonly #detail: string;\n  readonly #from: string;\n  readonly #kind: "a" | "b";\n}')).toHaveLength(0);
    expect(noPrimitiveFieldsInDomain("design/domain/foo.ts", "export interface Foo {\n  judge(): boolean;\n  readonly reason?: string;\n  readonly [k: string]: string;\n  readonly on: () => void;\n}")).toHaveLength(0);
    expect(noPrimitiveFieldsInDomain("kernel/domain/expression.ts", "export interface Expression {\n  readonly op: string;\n}")).toHaveLength(0);
    // 台帳は空（裁定 3-1〜3-4）: コレクション形の primitive も台帳の陰に隠れず違反になる。
    expect(noPrimitiveFieldsInDomain("kernel/domain/fr-refs.ts", "export class FrRefs {\n  readonly #values: readonly string[];\n}")).toHaveLength(1);
    expect(noPrimitiveFieldsInDomain("kernel/domain/fr-refs.ts", "export class FrRefs {\n  readonly #values: readonly string[];\n  readonly #newcomer: string;\n}")).toHaveLength(2);
    // prose の除外（裁定 3-2／3-3）: EARS 文と witness の原文トークン。
    expect(noPrimitiveFieldsInDomain("requirements/domain/foo.ts", "export class Foo {\n  readonly #ears: string | undefined;\n  readonly #value: string | undefined;\n  readonly #x: number;\n}")).toHaveLength(1);
    expect(noPrimitiveFieldsInDomain("design/adapter/foo.ts", "export class Foo {\n  readonly #name: string;\n}")).toHaveLength(0);
    // 検出器はコメント・文字列内の型らしき記述に反応しない。
    expect(primitiveFieldsOf("export class Foo {\n  // readonly #ghost: string;\n  readonly #label: string;\n  readonly #real: number;\n}")).toEqual(["#real: number"]);
  });

  test("domain-fields-are-private flags every non-# field of a domain class and ignores door signatures", () => {
    expect(domainFieldsArePrivate("design/domain/foo.ts", "export class Foo {\n  readonly bar: string;\n  #ok: string;\n}")).toHaveLength(1);
    expect(domainFieldsArePrivate("design/domain/foo.ts", "export class Foo {\n  public count = 0;\n  private secret: number;\n  static readonly EMPTY = new Foo();\n  protected x?: string;\n}")).toHaveLength(4);
    expect(domainFieldsArePrivate("design/domain/foo.ts", "export class Foo {\n  readonly #bar: string;\n  static #cache: Foo | null = null;\n  bar(): string {\n    return this.#bar;\n  }\n}")).toHaveLength(0);
    // ドア署名の無名インライン object 型（深さ 2）の行はフィールドではない。
    expect(domainFieldsArePrivate("design/domain/foo.ts", "export class Foo {\n  readonly #id: string;\n  static reconstitute(seed: {\n    readonly id: string;\n    readonly name?: string;\n  }): Foo {\n    return new Foo(seed);\n  }\n  match<T>(handlers: { a: () => T; b: (x: number) => T }): T {\n    const local: { readonly k: string } = { k: \"\" };\n    return handlers.a();\n  }\n}")).toHaveLength(0);
    // 複数行の引数リスト（丸括弧の中）の行もフィールドではない。
    expect(domainFieldsArePrivate("design/domain/foo.ts", "export class Foo {\n  readonly #id: string;\n  static versionMismatch(\n    id: string,\n    model: number,\n    method: string,\n  ): Foo {\n    return new Foo(id);\n  }\n}")).toHaveLength(0);
    expect(domainFieldsArePrivate("design/adapter/foo.ts", "export class Foo {\n  readonly bar: string;\n}")).toHaveLength(0);
    expect(domainFieldsArePrivate("design/domain/foo.ts", "export class Boom extends Error {\n  readonly code: number;\n}")).toHaveLength(1);
  });

  test("published-language-layers confines every table entry to its layers", () => {
    expect(publishedLanguageLayers("design/usecase/foo.ts", 'import type { Expression } from "../../kernel/domain/index.ts";\nexport function f(e: Expression): void {}')).toHaveLength(1);
    expect(publishedLanguageLayers("design/domain/foo.ts", 'import type { Expression } from "../../kernel/domain/index.ts";\nexport function f(e: Expression): void {}')).toHaveLength(0);
    expect(publishedLanguageLayers("design/adapter/foo.ts", "const x: AttrPaths = y;")).toHaveLength(1);
    expect(publishedLanguageLayers("design/domain/foo.ts", "const x: AttrPaths = y;")).toHaveLength(0);
    expect(publishedLanguageLayers("aidlc-sensor-deep-spec-verify-smt.ts", "const k = KeyedIndex.empty();")).toHaveLength(1);
    // 文字列・コメントの中の名前には反応しない。
    expect(publishedLanguageLayers("design/usecase/foo.ts", '// Expression is documented here\nconst s = "Expression";')).toHaveLength(0);
    expect(publishedLanguageLayers("design/usecase/foo.ts", "const expressionCount = 1;")).toHaveLength(0);
  });

  test("no-export-star flags a wildcard re-export, passes an explicit facade", () => {
    expect(noExportStar("kernel/domain/index.ts", 'export * from "./digest.ts";')).not.toHaveLength(0);
    expect(noExportStar("kernel/domain/index.ts", 'export { Digest } from "./digest.ts";')).toHaveLength(0);
  });

  test("layer-direction flags domain→adapter, adapter→foreign-context, passes sanctioned edges", () => {
    expect(layerDirection("kernel/domain/x.ts", 'import { y } from "../adapter/y.ts";')).not.toHaveLength(0);
    expect(layerDirection("refcheck/adapter/x.ts", 'import { y } from "../../design/domain/y.ts";')).not.toHaveLength(0);
    expect(layerDirection("refinement/domain/x.ts", 'import { y } from "../../requirements/domain/y.ts";')).toHaveLength(0);
    expect(layerDirection("design/usecase/x.ts", 'import { y } from "../../refinement/domain/y.ts";')).toHaveLength(0);
    expect(layerDirection("design/usecase/x.ts", 'import { y } from "../domain/y.ts";')).toHaveLength(0);
  });

  test("a relative import escaping tools/ (unclassified target) is flagged", () => {
    expect(layerDirection("kernel/domain/x.ts", 'import { h } from "../../../tests/helper.ts";')).not.toHaveLength(0);
  });

  test("infrastructure knows nothing above it, and every layer may reach it", () => {
    expect(layerDirection("kernel/infrastructure/x.ts", 'import { y } from "../domain/y.ts";')).not.toHaveLength(0);
    expect(layerDirection("kernel/infrastructure/x.ts", 'import { y } from "../adapter/y.ts";')).not.toHaveLength(0);
    expect(layerDirection("kernel/domain/x.ts", 'import { ok } from "../infrastructure/result.ts";')).toHaveLength(0);
    expect(layerDirection("requirements/usecase/x.ts", 'import { ok } from "../../kernel/infrastructure/index.ts";')).toHaveLength(0);
    expect(layerDirection("refcheck/adapter/x.ts", 'import { ok } from "../../kernel/infrastructure/index.ts";')).toHaveLength(0);
  });

  test("locationOf classifies entries, legacy files, data, and layered paths", () => {
    expect(locationOf("aidlc-sensor-deep-spec-ir-valid.ts")).toBe("entry");
    expect(locationOf("deep-spec-analysis-doctor.ts")).toBe("entry");
    expect(locationOf("data/deep-spec-ir-schema.json")).toBe("data");
    expect(locationOf("kernel/domain/digest.ts")).toEqual({ context: "kernel", layer: "domain" });
  });
});

describe("the real tools/ tree", () => {
  const files = walkToolsFiles();

  test("contains the nine flat sensor entries and the doctor", () => {
    for (const entry of ENTRY_FILES) expect(files).toContain(entry);
  });

  test("every file passes every architecture rule", () => {
    const all = files.flatMap((rel) => violationsOf(rel, readFileSync(join(toolsDir, rel), "utf-8")));
    expect(all).toEqual([]);
  });

  test("the published-language table is the only exemption: every entry exists, exports its name, and lives in the domain", () => {
    // 表の項目はパス・理由・利用可能層を持ち、その名前の型をそのファイルが公開する。
    for (const [rel, entry] of PUBLISHED_LANGUAGE) {
      expect(files).toContain(rel);
      const loc = locationOf(rel);
      expect(typeof loc !== "string" && loc?.layer).toBe("domain");
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.layers.length).toBeGreaterThan(0);
      const source = readFileSync(join(toolsDir, rel), "utf-8");
      expect(new RegExp(`^export (?:class|interface|type) ${entry.name}\\b`, "m").test(source)).toBe(true);
    }
    // domain の公開 interface は表の項目だけ（データモデルの再流入は規則が止める）。
    const interfaces = files
      .filter((rel) => { const loc = locationOf(rel); return typeof loc !== "string" && loc?.layer === "domain"; })
      .flatMap((rel) => [...readFileSync(join(toolsDir, rel), "utf-8").matchAll(/^export interface (\w+)/gm)].map((m) => `${rel}:${m[1]}`));
    expect(interfaces).toEqual(["kernel/domain/expression.ts:Expression"]);
  });

  test("every file is either layered, an entry, legacy, or data — nothing unclassified", () => {
    const unclassified = files.filter((rel) => locationOf(rel) === null);
    expect(unclassified).toEqual([]);
  });

  test("the legacy allowlist is empty — every flat file is a sanctioned entry (PR10 closeout)", () => {
    const flat = files.filter((rel) => !rel.includes("/"));
    for (const rel of flat) expect(ENTRY_FILES.has(rel)).toBe(true);
    // entry は層規律の免除ではなく配線役割: 9 センサー + doctor の固定集合から
    // 増えない(新規フラットファイルはこのテストで落ちる)。
    expect(ENTRY_FILES.size).toBe(10);
  });
});
