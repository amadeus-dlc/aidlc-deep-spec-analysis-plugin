// アーキテクチャルール — src/ 配下の import 方向と層規律を検査する純粋関数群。
//
// 各ルールは (src/ からの相対パス, ソーステキスト) を受けて違反を返す。
// テスト側は必ず red example（違反を検出できることの証明）と green example を
// 先に流してから実ツリーへ適用する（カスタム検査の DoD）。

export interface Violation {
  readonly path: string;
  readonly rule: string;
  readonly detail: string;
}

// 合成ルート（entry）。ディスパッチャが basename で解決するため src/entries/ に
// 平置きし、配布物にもその名前で束ねられる。層規律の免除ではなく「配線だけを
// 持つ役割」で、process.*/import.meta を許される唯一の場所。entries/ の外に
// 平置きのファイルは無く、層にも entries にも属さないパスは未分類として違反。
export const ENTRY_FILES: ReadonlySet<string> = new Set([
  "entries/aidlc-sensor-deep-spec-ir-valid.ts",
  "entries/aidlc-sensor-deep-spec-verify-smt.ts",
  "entries/aidlc-sensor-deep-spec-verify-quint.ts",
  "entries/aidlc-sensor-deep-spec-refcheck-domain.ts",
  "entries/aidlc-sensor-deep-spec-refcheck-contract.ts",
  "entries/aidlc-sensor-deep-spec-refcheck-functional.ts",
  "entries/aidlc-sensor-deep-spec-design-ir-valid.ts",
  "entries/aidlc-sensor-deep-spec-design-verify-smt.ts",
  "entries/aidlc-sensor-deep-spec-design-verify-quint.ts",
  "entries/deep-spec-analysis-doctor.ts",
]);

const CONTEXTS = ["kernel", "requirements", "design", "refinement", "refcheck", "doctor"] as const;
// infrastructure は「言語を拡張する技術基盤」専用の最内層（オーナー裁定
// 2026-08-30）：手巻き Result 等、ユビキタス言語でない純基盤を置く。
// RPC クライアント・永続化は置かない——それらは adapter のゲートウェイ責務。
const LAYERS = ["infrastructure", "domain", "usecase", "adapter"] as const;

// 層パッケージの bare specifier の接頭辞。src/<ctx>/<layer>/ の 17 層は
// それぞれ workspace パッケージ @deep-spec/<ctx>-<layer> で、層をまたぐ辺は
// この形だけで書く（src/entries/ は @deep-spec/entries）。
const PACKAGE_SCOPE = "@deep-spec/";

type Layer = (typeof LAYERS)[number];

interface Location {
  readonly context: string;
  readonly layer: Layer;
}

// 受け取るパスは src/ からの相対（kernel/domain/digest.ts・
// entries/deep-spec-analysis-doctor.ts・entries/data/deep-spec-ir-schema.json）。
// 契約スキーマは entry と同階層の entries/data/ にある——entry は自ファイルから
// の相対で data/ を引くので、ソースツリーと出荷物で相対関係を揃えてある。
export function locationOf(relPath: string): Location | "entry" | "data" | null {
  if (ENTRY_FILES.has(relPath)) return "entry";
  const segments = relPath.split("/");
  if (segments[0] === "entries" && segments[1] === "data") return "data";
  if (segments.length >= 3 && (CONTEXTS as readonly string[]).includes(segments[0]) && (LAYERS as readonly string[]).includes(segments[1])) {
    return { context: segments[0], layer: segments[1] as Layer };
  }
  return null;
}

// コメントを除去してから検査する（説明文中の「process.argv」「export *」等への
// 過剰一致の防止）。正規表現置換では文字列リテラル内の // をコメント開始と
// 誤認して以降のコードを検査から落とすため、文字列・テンプレートリテラルを
// 状態として追跡する字句走査で除去する。正規表現リテラル内の // は未対応
//（除算と構文的に区別できず、実コードでの出現も想定されない既知の限界）。
// 文字列リテラルの内容を空にして返す(コメントも除去)。正規表現ベースの
// 構文検査が文字列内のトークンに誤爆しないための前処理。テンプレート
// リテラルは補間ごと落とす(補間内の違反は検出しない——偽陰性側に倒す)。
export function stripStrings(rawSource: string): string {
  const source = stripComments(rawSource);
  let out = "";
  type State = "code" | "single" | "double" | "template";
  let state: State = "code";
  for (let i = 0; i < source.length; i++) {
    const c = source[i] ?? "";
    if (state === "code") {
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "template";
      out += c;
    } else {
      if (c === "\\") {
        i++;
        continue;
      }
      if ((state === "single" && c === "'") || (state === "double" && c === '"') || (state === "template" && c === "`")) {
        state = "code";
        out += c;
      } else if (c === "\n") {
        out += c;
      }
    }
  }
  return out;
}

export function stripComments(source: string): string {
  let out = "";
  type State = "code" | "single" | "double" | "template" | "line" | "block";
  let state: State = "code";
  for (let i = 0; i < source.length; i++) {
    const c = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        i++;
      } else if (c === "/" && next === "*") {
        state = "block";
        i++;
      } else {
        if (c === "'") state = "single";
        else if (c === '"') state = "double";
        else if (c === "`") state = "template";
        out += c;
      }
    } else if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      }
    } else if (state === "block") {
      if (c === "*" && next === "/") {
        state = "code";
        i++;
      } else if (c === "\n") {
        out += c;
      }
    } else {
      // 文字列内: エスケープを 1 文字飛ばし、閉じ引用符で code へ戻る。
      if (c === "\\") {
        out += c + next;
        i++;
        continue;
      }
      if ((state === "single" && c === "'") || (state === "double" && c === '"') || (state === "template" && c === "`")) {
        state = "code";
      }
      out += c;
    }
  }
  return out;
}

export function importSpecifiers(rawSource: string): string[] {
  const source = stripComments(rawSource);
  const specs: string[] = [];
  // import 文の構造（default / namespace / named / side-effect / export-from /
  // 動的 import）に厳密一致させる。緩い「from "…" を拾う」方式は本文の
  // 文字列リテラル（例: `enum mapping from "x"`）に過剰一致する。
  const patterns = [
    /^import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?(?:[\w$]+|\*\s+as\s+[\w$]+|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/gm,
    /^import\s+["']([^"']+)["']/gm,
    /^export\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+["']([^"']+)["']/gm,
    /^export\s*\*\s*(?:as\s+[\w$]+\s+)?from\s+["']([^"']+)["']/gm,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const m of source.matchAll(pattern)) specs.push(m[1]);
  }
  return specs;
}

// bare specifier のターゲットを分類する。@deep-spec/<ctx>-<layer> は層
// パッケージ、@deep-spec/entries は合成ルート、それ以外（node:* や公認 npm）は
// 層規律の対象外＝null。
function packageLocationOf(specifier: string): Location | "entry" | null {
  if (!specifier.startsWith(PACKAGE_SCOPE)) return null;
  const name = specifier.slice(PACKAGE_SCOPE.length).split("/")[0] ?? "";
  if (name === "entries") return "entry";
  for (const context of CONTEXTS) {
    if (!name.startsWith(`${context}-`)) continue;
    const layer = name.slice(context.length + 1);
    if ((LAYERS as readonly string[]).includes(layer)) return { context, layer: layer as Layer };
  }
  return null;
}

// パッケージのディレクトリ（src/ からの相対）。層は <ctx>/<layer>、entry は
// entries。data と未分類はパッケージを持たない。
function packageRootOf(relPath: string): string | null {
  const loc = locationOf(relPath);
  if (loc === "entry") return "entries";
  if (loc === null || typeof loc === "string") return null;
  return relPath.split("/").slice(0, 2).join("/");
}

function resolveRelative(fromRelPath: string, specifier: string): string {
  const base = fromRelPath.split("/").slice(0, -1);
  for (const seg of specifier.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") base.pop();
    else base.push(seg);
  }
  return base.join("/");
}

// ルール: src/ にテストペイロードを置かない（validator/compose の双方が拒否・drop する）。
export function noTestPayloads(relPath: string, _source: string): Violation[] {
  const segments = relPath.split("/");
  const badDir = segments.slice(0, -1).find((s) => s === "tests" || s === "fixtures" || s === "__tests__");
  const base = segments[segments.length - 1];
  const out: Violation[] = [];
  if (badDir) out.push({ path: relPath, rule: "no-test-payloads", detail: `forbidden directory segment "${badDir}"` });
  if (base.endsWith(".test.ts") || base.endsWith(".spec.ts")) {
    out.push({ path: relPath, rule: "no-test-payloads", detail: `forbidden test file basename "${base}"` });
  }
  return out;
}

// ルール: 外部依存を持ち込まない。許されるのは node:* / パッケージ内の相対
// import / 層パッケージの bare specifier（@deep-spec/*）/ 公認の optional
// 依存（z3-solver の動的 import）のみ。@deep-spec/* の行き先が実在する層かは
// layer-direction が、パッケージの外へ出る相対 import は
// no-cross-package-relative-imports が受け持つ。
const ALLOWED_NPM: ReadonlySet<string> = new Set(["z3-solver"]);

export function onlySanctionedImports(relPath: string, source: string): Violation[] {
  const out: Violation[] = [];
  for (const spec of importSpecifiers(source)) {
    const sanctioned =
      spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith(PACKAGE_SCOPE) || ALLOWED_NPM.has(spec);
    if (!sanctioned) out.push({ path: relPath, rule: "only-sanctioned-imports", detail: `import "${spec}"` });
  }
  // 動的 import の引数が引用符リテラルでないもの（テンプレートリテラル・
  // 文字列連結・変数）は解析不能＝検査回避経路になるため一律違反にする。
  const dynamicAll = [...source.matchAll(/\bimport\s*\(/g)].length;
  const dynamicLiteral = [...source.matchAll(/import\(\s*["'][^"']+["']\s*\)/g)].length;
  if (dynamicAll > dynamicLiteral) {
    out.push({
      path: relPath,
      rule: "only-sanctioned-imports",
      detail: `${dynamicAll - dynamicLiteral} dynamic import(s) with a non-literal argument`,
    });
  }
  return out;
}

// ルール: entry を import してよいファイルは存在しない（entry は合成ルートで
// あり、spawn 対象としてのみ参照される——パスは文字列注入）。
export function noEntryImports(relPath: string, source: string): Violation[] {
  const out: Violation[] = [];
  for (const spec of importSpecifiers(source)) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRelative(relPath, spec);
    if (ENTRY_FILES.has(target)) {
      out.push({ path: relPath, rule: "no-entry-imports", detail: `imports the composition root "${target}"` });
    }
  }
  return out;
}

// ルール: パッケージの外へ出る相対 import を禁じる（FR1.5）。層をまたぐ辺は
// bare specifier（@deep-spec/<ctx>-<layer>）で書く——相対で潜り込むと isolated
// linker が張った「宣言済みの依存だけ」というゲートを迂回でき、層規律が実行時に
// 素通りする。パッケージ内（自分の <ctx>/<layer>/ 配下、entry なら entries/
// 配下）に閉じる相対 import だけが通る。
export function noCrossPackageRelativeImports(relPath: string, source: string): Violation[] {
  const root = packageRootOf(relPath);
  if (root === null) return [];
  const out: Violation[] = [];
  for (const spec of importSpecifiers(source)) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRelative(relPath, spec);
    if (target === root || target.startsWith(`${root}/`)) continue;
    out.push({
      path: relPath,
      rule: "no-cross-package-relative-imports",
      detail: `relative import "${spec}" leaves package ${root} (resolves to "${target}") — cross-package edges are bare specifiers`,
    });
  }
  return out;
}

// ルール: domain 層は I/O を知らない。node:* は node:crypto（純計算の sha256）
// のみ許可。usecase 層は fs / child_process / os を禁止。
function isModuleOrSubpath(spec: string, module: string): boolean {
  return spec === module || spec.startsWith(`${module}/`);
}

// bare 形式（"fs" / "crypto" 等）も node: 接頭辞へ正規化してから判定する。
// bare の組み込みは onlySanctionedImports でも弾かれるが、I/O 規律の検査自体が
// すり抜けるのは規則単体の検出力の穴なので、二重に塞ぐ。
const NODE_BUILTINS: ReadonlySet<string> = new Set([
  "fs", "crypto", "child_process", "os", "path", "url", "process", "util", "stream", "buffer",
]);

function normalizeNodeSpecifier(spec: string): string | null {
  if (spec.startsWith("node:")) return spec;
  const head = spec.split("/")[0] ?? "";
  return NODE_BUILTINS.has(head) ? `node:${spec}` : null;
}

export function noIoInPureLayers(relPath: string, source: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string") return [];
  const out: Violation[] = [];
  for (const rawSpec of importSpecifiers(source)) {
    const spec = normalizeNodeSpecifier(rawSpec);
    if (spec === null) continue;
    // infrastructure は純粋な言語拡張——node への依存自体を持たない。
    if (loc.layer === "infrastructure") {
      out.push({ path: relPath, rule: "no-io-in-pure-layers", detail: `infrastructure imports "${rawSpec}"` });
    }
    if (loc.layer === "domain" && spec !== "node:crypto") {
      out.push({ path: relPath, rule: "no-io-in-pure-layers", detail: `domain imports "${rawSpec}"` });
    }
    // サブパス（node:fs/promises 等）も同一モジュールとして拒否する。
    if (loc.layer === "usecase" && ["node:fs", "node:child_process", "node:os"].some((m) => isModuleOrSubpath(spec, m))) {
      out.push({ path: relPath, rule: "no-io-in-pure-layers", detail: `usecase imports "${rawSpec}"` });
    }
  }
  return out;
}

// ルール: process.* と import.meta は entry（合成ルート）だけが触れてよい。
// 層構造のファイルに現れたら、注入し忘れた環境依存の証拠。
export function processOnlyInEntries(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string") return [];
  const source = stripComments(rawSource);
  const out: Violation[] = [];
  if (/\bprocess\s*\./.test(source)) {
    out.push({ path: relPath, rule: "process-only-in-entries", detail: "references process.*" });
  }
  if (/\bimport\.meta\b/.test(source)) {
    out.push({ path: relPath, rule: "process-only-in-entries", detail: "references import.meta" });
  }
  return out;
}

// ルール: export * 禁止（facade は明示列挙の named re-export のみ）。
export function noExportStar(relPath: string, rawSource: string): Violation[] {
  if (/^\s*export\s*\*/m.test(stripComments(rawSource))) {
    return [{ path: relPath, rule: "no-export-star", detail: "export * leaks the file tree as API" }];
  }
  return [];
}

// ルール: domain のクラスは private constructor + static ファクトリ(new は
// 自クラス内の 1 箇所——house style)。Error 派生の例外型だけは公開 ctor を許す。
export function privateConstructorInDomain(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "domain") return [];
  const source = stripComments(rawSource);
  const out: Violation[] = [];
  const classRe = /^export (?:abstract )?class (\w+)(?:\s+extends\s+(\w+))?/gm;
  for (let m = classRe.exec(source); m !== null; m = classRe.exec(source)) {
    const name = m[1] ?? "";
    if (m[2] === "Error") continue;
    const start = m.index;
    const next = source.indexOf("\nexport ", start + 1);
    const body = source.slice(start, next > 0 ? next : source.length);
    if (!body.includes("private constructor")) {
      out.push({ path: relPath, rule: "private-constructor-in-domain", detail: `class ${name} lacks a private constructor` });
    }
  }
  return out;
}

// 復元専用の生成口を設けず、生成と復元の不変条件を一本化する。
export function noReconstitutionBypass(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "domain") return [];
  if (/\bstatic\s+reconstitute\s*\(/.test(stripStrings(rawSource))) {
    return [{ path: relPath, rule: "no-reconstitution-bypass", detail: "restoration must use the same constructor contract as of" }];
  }
  return [];
}

// constructorの契約違反をResultへ変換できるのはドメインのparseだけ。
// adapterに汎用の例外変換ラッパーを置くとofのpanicまで回復してしまう。
export function constructionParsingInDomain(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer === "domain" || loc.layer === "infrastructure") return [];
  if (/\bparseConstruction\b/.test(stripStrings(rawSource))) {
    return [{ path: relPath, rule: "construction-parsing-in-domain", detail: "consume domain parse Results; do not catch construction panics" }];
  }
  return [];
}

// ルール: get アクセサ禁止(house style は振る舞いメソッド——プロパティ風の
// 露出はフィールド直触りの錯覚を生む)。
export function noGetAccessors(relPath: string, rawSource: string): Violation[] {
  const source = stripStrings(rawSource);
  if (/^\s+(?:public\s+|private\s+|protected\s+|static\s+)*get\s+\w+\s*\(/m.test(source)) {
    return [{ path: relPath, rule: "no-get-accessors", detail: "get accessor found — expose behaviour as a method" }];
  }
  return [];
}

// ルール: TS enum 禁止(閉集合は述語つき DP か literal union で運ぶ)。
export function noEnums(relPath: string, rawSource: string): Violation[] {
  const source = stripStrings(rawSource);
  if (/^\s*(?:export\s+)?(?:const\s+)?enum\s+\w+/m.test(source)) {
    return [{ path: relPath, rule: "no-enums", detail: "TS enum found — use a domain primitive or a literal union" }];
  }
  return [];
}

// ルール: 非 null 表明(x!)禁止——不在は Result / 明示分岐で運ぶ。
// 文字列とコメントを剥いだうえで、識別子・)・] 直後の ! を検出する
// (!= / !== は後続の = で除外)。
export function noNonNullAssertions(relPath: string, rawSource: string): Violation[] {
  const source = stripStrings(rawSource);
  if (/[\w\)\]]!(?![=])/.test(source)) {
    return [{ path: relPath, rule: "no-non-null-assertions", detail: "non-null assertion found — branch explicitly" }];
  }
  return [];
}

// ルール: 1 ファイル 1 公開型(Java 流——オーナー裁定 2026-09-01)。層化
// ファイルは公開型宣言(export class/interface/type/enum)を高々 1 つ持ち、
// その kebab-case はファイル名と一致する。従属する非公開型(export しない
// class/interface/type)は所有する公開型のファイルに同居してよい。facade
// (index.ts)は宣言を持たず再輸出のみ、entry は公開型を持たない。
export function kebabOf(typeName: string): string {
  // UseCase はこのリポジトリの確立済み一語("usecase")。
  return typeName
    .replace(/UseCase$/, "Usecase")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function onePublicTypePerFile(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null) return [];
  const source = stripStrings(rawSource);
  const decls: string[] = [];
  const re = /^export (?:abstract )?(?:class|interface|enum) (\w+)|^export type (\w+)\b/gm;
  for (let m = re.exec(source); m !== null; m = re.exec(source)) {
    decls.push(m[1] ?? m[2] ?? "");
  }
  const base = relPath.split("/").pop() ?? "";
  if (base === "index.ts") {
    return decls.length > 0
      ? [{ path: relPath, rule: "one-public-type-per-file", detail: `facade declares ${decls.join(", ")} — facades re-export only` }]
      : [];
  }
  const out: Violation[] = [];
  if (decls.length > 1) {
    out.push({ path: relPath, rule: "one-public-type-per-file", detail: `${decls.length} public types in one file: ${decls.join(", ")}` });
  }
  if (decls.length === 1 && typeof loc !== "string") {
    const expected = `${kebabOf(decls[0] ?? "")}.ts`;
    if (base !== expected) {
      out.push({ path: relPath, rule: "one-public-type-per-file", detail: `public type ${decls[0]} belongs in ${expected}, not ${base}` });
    }
  }
  if (typeof loc === "string" && decls.length > 0) {
    out.push({ path: relPath, rule: "one-public-type-per-file", detail: `entry declares public type(s) ${decls.join(", ")} — entries carry wiring only` });
  }
  return out;
}

// ルール: ポート契約の置き場（オーナー裁定 2026-09-01）。ポートは
// Repository（永続化）と外部システム Client（Z3SolverClient/QuintClient 型）
// の 2 種で、usecase 層のポートインターフェイスは usecase/port/ に集める。
// port/ 配下は契約のみ——class（interactor）を置かない。
export function portsLiveInPortDir(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "usecase") return [];
  const source = stripStrings(rawSource);
  const out: Violation[] = [];
  if (relPath.includes("/usecase/port/")) {
    const re = /^export (?:abstract )?class (\w+)/gm;
    for (let m = re.exec(source); m !== null; m = re.exec(source)) {
      out.push({ path: relPath, rule: "ports-live-in-port-dir", detail: `usecase/port/ carries contracts only — class ${m[1]} belongs beside the interactors` });
    }
  } else {
    const re = /^export interface (\w+(?:Repository|Client))\b/gm;
    for (let m = re.exec(source); m !== null; m = re.exec(source)) {
      out.push({ path: relPath, rule: "ports-live-in-port-dir", detail: `port contract ${m[1]} belongs under usecase/port/` });
    }
  }
  return out;
}

// 公開言語の表（#80 の最終ゲート、2026-09-03）: domain に置かれる「振る舞いを
// 持たない型」と「表現プリミティブ」はここに載る型だけで、名前ではなく
// パス・理由・利用可能層を持つ。data-model 規則と primitive フィールド規則は
// この表だけを免除し、publishedLanguageLayers がその型を利用できる層を検査する。
// 免除台帳は消えた——免除は表の項目だけで、項目を足すことは裁定である。
export const PUBLISHED_LANGUAGE: ReadonlyMap<string, { readonly name: string; readonly reason: string; readonly layers: readonly Layer[] }> = new Map([
  ["kernel/domain/expression.ts", { name: "Expression", reason: "契約1／契約3 の式ツリー——演算子の集合は契約スキーマの published language そのもの（既裁定）", layers: ["domain", "adapter"] }],
  ["kernel/domain/keyed-index.ts", { name: "KeyedIndex", reason: "DP をキーにする索引の表現プリミティブ——string キーの Map を持つ唯一の場所（裁定 3-1、2026-09-03）", layers: ["domain", "adapter"] }],
  ["kernel/domain/key-set.ts", { name: "KeySet", reason: "DP の集合の表現プリミティブ——KeyedIndex と同じ理屈（裁定 3-1、2026-09-03）", layers: ["domain", "adapter"] }],
  ["kernel/domain/error-messages.ts", { name: "ErrorMessages", reason: "凍結 verdict 文言の列（prose——文字列単位の DP 化はしない、#46 の宣言済み除外）", layers: ["domain", "adapter"] }],
  ["design/domain/attr-paths.ts", { name: "AttrPaths", reason: "設計属性パス集合（state トークン——enum 宣言値への参照と同じ扱い）", layers: ["domain"] }],
  ["design/domain/declared-values.ts", { name: "DeclaredValues", reason: "enum 宣言値の集合（state トークン——序数符号化と文言順の凍結面）", layers: ["domain", "adapter"] }],
  ["design/domain/initial-states.ts", { name: "InitialStates", reason: "機械の初期状態集合（state トークン）", layers: ["domain", "adapter"] }],
  ["requirements/domain/attribute-values.ts", { name: "AttributeValues", reason: "enum 宣言値の集合（state トークン——SMT の序数符号化・Quint の集合リテラル順の凍結面）", layers: ["domain", "adapter"] }],
  ["requirements/domain/ir-declared-values.ts", { name: "IrDeclaredValues", reason: "enum 属性の宣言値（state トークン——序数対応・文言順の凍結面）", layers: ["domain", "adapter"] }],
  ["requirements/domain/fr-ref-claim.ts", { name: "FrRefClaim", reason: "frRefs の主張——owner は義務／シナリオ／unformalized の位置が混成する参照トークン", layers: ["domain", "adapter"] }],
  ["design/domain/req-attribute-values.ts", { name: "ReqAttributeValues", reason: "enum 属性の宣言値（state トークン——decode の序数対応の凍結面）", layers: ["domain", "adapter"] }],
]);

// ルール: domain 層にデータモデルを置かない（主従の裁定・MECE フェンス
// 2026-09-01、#71。#80 で最終形）。domain の公開 interface／object 型が
// プロパティを 1 つでも持てばデータモデル——メソッドを添えても免除されない
//（「メソッドが一つあれば合格」の抜け道は #80 で塞いだ）。命令できる class へ
// 反転するか、ドア署名の無名インライン引数へ解散する。免除は公開言語の表の
// 項目だけ。
export function noDataModelsInDomain(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "domain") return [];
  const published = PUBLISHED_LANGUAGE.get(relPath)?.name;
  const source = stripStrings(rawSource);
  const out: Violation[] = [];
  // 型引数付き（export interface X<T> {）も拾う——LoadedDocument<Outcome> が
  // 抜けていた穴（種別規律の裁定 16、#71 波39）。型引数の角括弧は 2 段まで
  // ネストを追う（X<T extends Promise<string>>——レビュー指摘の回避経路）。
  const typeParams = "(?:<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?";
  for (const m of source.matchAll(new RegExp(`^export interface (\\w+)${typeParams}\\s*(?:extends [\\w<>, ]+)?\\{([\\s\\S]*?)^\\}`, "gm"))) {
    const name = m[1] ?? "";
    if (name === published) continue;
    // プロパティ宣言（`readonly a: T` / `a?: T` / index signature）が 1 つでもあれば
    // データモデル。メソッド署名（`judge(): boolean`）とは見分け、コールバック型の
    // プロパティ（`on: () => void`）は値を持つ面としてプロパティに数える。
    const members = (m[2] ?? "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
    const properties = members.filter((line) => /^(?:readonly\s+)?(?:\w+\??|\[\w+:\s*\w+\])\s*:/.test(line));
    if (properties.length > 0) {
      out.push({ path: relPath, rule: "no-data-models-in-domain", detail: `interface ${name} exposes ${properties.length} propert${properties.length === 1 ? "y" : "ies"} — a data model; make it commandable or dissolve it into a door signature` });
    }
  }
  // ジェネリック别名（export type Foo<T> = …）と末尾セミコロン省略の両方も
  // 拾う（波3のレビュー指摘——検査回避経路を塞ぐ）。
  for (const m of source.matchAll(/^export type (\w+)(?:<[^>]*>)?\s*=\s*([\s\S]*?);?$/gm)) {
    if ((m[1] ?? "") === published) continue;
    const rhs = m[2] ?? "";
    if (/^\s*\{/.test(rhs) || (rhs.includes("{") && rhs.includes("|"))) {
      out.push({ path: relPath, rule: "no-data-models-in-domain", detail: `record-shaped type alias ${m[1]} is a data model — make it commandable or dissolve it into a door signature` });
    }
  }
  return out;
}

// ルール: domain class のフィールドは `#private`（#80 の最終ゲート、2026-09-03）。
// 公開・protected・TS private のフィールド宣言（初期化子つき・static を含む）は
// 違反——public mutable state はもちろん、readonly の公開フィールドも「読ませる
// 面」を作る。読ませる面はメソッド（I/O の読み手のための getter）で出す。
// class 本体の直下だけを見る（ドア署名の無名インライン object 型の行は深さ 2
// 以上なので拾わない）。
export function domainFieldsArePrivate(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "domain") return [];
  const source = stripComments(stripStrings(rawSource));
  const out: Violation[] = [];
  const classRe = /^export (?:abstract )?class (\w+)/gm;
  for (let m = classRe.exec(source); m !== null; m = classRe.exec(source)) {
    const name = m[1] ?? "";
    // class 本体の `{` は型引数の外で最初に現れるもの——`class KeySet<K extends
    // { asString(): string }>` の制約の `{` を本体と誤認しない（レビュー指摘）。
    // 山括弧の深さを追い、`=>` の `>` は数えない。
    let angle = 0;
    let bodyStart = -1;
    for (let i = m.index + m[0].length; i < source.length; i++) {
      const c = source[i] ?? "";
      if (c === "<") angle++;
      else if (c === ">" && source[i - 1] !== "=") angle--;
      else if (c === "{" && angle === 0) {
        bodyStart = i + 1;
        break;
      }
    }
    if (bodyStart < 0) continue;
    // class 本体を深さつきで行に切る（波括弧の深さ 1 かつ丸括弧の外 = 本体直下の
    // 宣言。複数行の引数リストや無名インライン object 型の行はここに来ない）。
    let depth = 1;
    let parens = 0;
    let line = "";
    let lineDepth = 1;
    let lineParens = 0;
    const lines: { depth: number; parens: number; text: string }[] = [];
    for (let i = bodyStart; i < source.length && depth > 0; i++) {
      const c = source[i] ?? "";
      if (c === "\n") {
        lines.push({ depth: lineDepth, parens: lineParens, text: line });
        line = "";
        lineDepth = depth;
        lineParens = parens;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === "(") parens++;
      else if (c === ")") parens--;
      line += c;
    }
    for (const { depth: d, parens: p, text } of lines) {
      if (d !== 1 || p !== 0) continue;
      const field = /^\s*(?:(?:public|protected|private)\s+)?(?:static\s+)?(?:readonly\s+)?([A-Za-z_]\w*)\s*[?!]?\s*[:=]/.exec(text);
      if (field) {
        out.push({ path: relPath, rule: "domain-fields-are-private", detail: `class ${name} declares a non-private field ${field[1]} — keep state in a #private field and expose behaviour or an I/O reader` });
      }
    }
  }
  return out;
}

// ルール: 公開言語の型はその表が許す層だけが利用できる（#80 の最終ゲート、
// 2026-09-03）。表の型名を識別子として使うファイルが許可層の外にあれば違反
//（usecase と entry は公開言語を直接扱わない——値は domain の門か adapter の
// 変換を通る）。
export function publishedLanguageLayers(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null) return [];
  const source = stripComments(stripStrings(rawSource));
  const out: Violation[] = [];
  for (const [path, entry] of PUBLISHED_LANGUAGE) {
    if (path === relPath) continue;
    if (typeof loc !== "string" && entry.layers.includes(loc.layer)) continue;
    if (new RegExp(`\\b${entry.name}\\b`).test(source)) {
      out.push({ path: relPath, rule: "published-language-layers", detail: `${entry.name} (${path}) may be used only in ${entry.layers.join(", ")} layers` });
    }
  }
  return out;
}

// ルール: domain 層に primitive 型のフィールドを置かない（Ruling A「domain
// primitives everywhere」2026-08-31、#71 波11 で機械化、#80 で最終形）。bool を
// 除く string / number とその列・集合・map をフィールドに持つ domain の class・
// 公開 interface／type はドメインプリミティブへ包むかドアの内側へ隠す。
// 免除は形で決まる: DP ラッパー自身（唯一の #value）、prose（detail / reason /
// message / ears 等の説明文とその列）、state トークン（enum 宣言値への参照:
// state / from / to とその列）——名前ベースの除外リストと免除台帳は消え、公開
// 言語の表（PUBLISHED_LANGUAGE）の項目だけが理由つきで免除される。
// 既知の限界: 非公開の type 別名（Result のエラー材料）と index signature
// 型（{ [k: string]: … }）は見ない。
const PROSE_FIELD_NAMES: ReadonlySet<string> = new Set([
  "detail", "details", "reason", "unavailableReason", "unavailable", "unsupported", "missing", "missingKeys",
  "message", "messages", "error", "outputTail", "label", "fix", "rulesMarkdown", "description", "text",
  // 裁定 3-2／3-3（2026-09-03）: EARS 正規化文（契約1 の項目、LLM が読む）と
  // witness ref の原文トークン（サニタイズ前の値を人間のために逐語で残す欄）。
  "ears", "value",
]);

const STATE_TOKEN_FIELD_NAMES: ReadonlySet<string> = new Set(["state", "from", "to", "attrPath"]);

const PRIMITIVE_TYPE_SHAPES: readonly RegExp[] = [
  /^(?:readonly)?(?:string|number)(?:\[\])?$/,
  /^(?:Readonly)?(?:Set|Array)<(?:string|number)>$/,
  /^(?:Readonly)?Map<(?:string|number),/,
  /^(?:Readonly)?Map<[^,]+,(?:readonly)?(?:string|number)(?:\[\])?>$/,
];

function isPrimitiveShape(rawType: string): boolean {
  let type = rawType.replace(/\s+/g, "");
  for (;;) {
    const stripped = type.replace(/\|(?:undefined|null)$/, "").replace(/^\((.*)\)$/, "$1");
    if (stripped === type) break;
    type = stripped;
  }
  return PRIMITIVE_TYPE_SHAPES.some((shape) => shape.test(type));
}

function braceGroups(text: string): string[] {
  const out: string[] = [];
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") stack.push(i);
    else if (c === "}" && stack.length > 0) {
      const start = stack.pop() ?? 0;
      out.push(text.slice(start + 1, i));
    }
  }
  return out;
}

function blankNested(body: string): string {
  let depth = 0;
  let out = "";
  for (const c of body) {
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0) out += c;
    else if (c === "\n") out += c;
  }
  return out;
}

// 検出器: primitive 型フィールドの記述子（"name: type"）を返す。層・除外・
// 免除の判断は noPrimitiveFieldsInDomain が担う。
export function primitiveFieldsOf(rawSource: string): string[] {
  const source = stripStrings(rawSource);
  const out: string[] = [];
  // private フィールド: 型注釈つき（初期化子・definite assignment `!`・無インデントも
  // 含む）と、型注釈なしの初期化子（リテラルから string / number を推定——文字列は
  // stripStrings で空リテラルになっている）。レビュー指摘の死角をすべて塞ぐ。
  const typedFields = [...source.matchAll(/^\s*(?:static\s+)?(?:readonly\s+)?(#\w+)[?!]?:\s*([^;=]+?)(?:\s*=\s*[^;]*)?;?$/gm)]
    .map((m) => ({ name: (m[1] ?? "").slice(1), type: (m[2] ?? "").trim() }));
  const inferredFields = [...source.matchAll(/^\s*(?:static\s+)?(?:readonly\s+)?(#\w+)\s*=\s*([^;]+?);?$/gm)]
    .map((m) => ({ name: (m[1] ?? "").slice(1), initializer: (m[2] ?? "").trim() }))
    .filter((f) => /^-?[0-9][0-9_.]*$/.test(f.initializer) || /^(?:""|''|``)$/.test(f.initializer))
    .map((f) => ({ name: f.name, type: /^-?[0-9]/.test(f.initializer) ? "number" : "string" }));
  const privateFields = [...typedFields, ...inferredFields];
  const isPrimitiveWrapper = privateFields.length === 1 && privateFields[0]?.name === "value";
  if (!isPrimitiveWrapper) {
    for (const { name, type } of privateFields) {
      if (PROSE_FIELD_NAMES.has(name) || STATE_TOKEN_FIELD_NAMES.has(name)) continue;
      if (isPrimitiveShape(type)) out.push(`#${name}: ${type}`);
    }
  }
  // 宣言本文は次のトップレベル宣言（export / type / class / const …）の直前まで。
  for (const decl of source.matchAll(/^export (?:interface|type) (\w+)[\s\S]*?(?=\n(?:export|type|interface|class|const|function|let)\s|$(?![\s\S]))/gm)) {
    for (const group of braceGroups(decl[0])) {
      for (const member of blankNested(group).split(/[;\n]/)) {
        const prop = /^\s*(?:readonly\s+)?(\w+)\??:\s*(.+?)\s*$/.exec(member);
        if (!prop) continue;
        const name = prop[1] ?? "";
        const type = prop[2] ?? "";
        if (PROSE_FIELD_NAMES.has(name) || STATE_TOKEN_FIELD_NAMES.has(name)) continue;
        if (isPrimitiveShape(type)) out.push(`${decl[1]}.${name}: ${type}`);
      }
    }
  }
  return out;
}

export function noPrimitiveFieldsInDomain(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "domain") return [];
  if (PUBLISHED_LANGUAGE.has(relPath)) return [];
  return primitiveFieldsOf(rawSource).map((field) => ({
    path: relPath,
    rule: "no-primitive-fields-in-domain",
    detail: `primitive-typed field ${field} — wrap it in a domain primitive or keep it behind a DP door`,
  }));
}

// ルール: CQS——コマンドは返さない（オーナー裁定 2026-09-01）。ポートの
// store は書くだけ：正常時は void で、集約を読み込んで返さない。複数件の
// 書き込みだけが正常件数か事前採番の集約 ID 集合を返してよい（現行ポートに
// 複数件書きは無いので、機械検査は単文書 store の void を締める）。
export function commandsReturnVoid(relPath: string, rawSource: string): Violation[] {
  if (!relPath.includes("/usecase/port/")) return [];
  const source = stripStrings(rawSource);
  const out: Violation[] = [];
  const re = /^\s*store\([^)]*\):\s*Result<(\w+)/gm;
  for (let m = re.exec(source); m !== null; m = re.exec(source)) {
    if (m[1] !== "void") {
      out.push({ path: relPath, rule: "commands-return-void", detail: `store returns Result<${m[1]}, …> — commands return void (CQS)` });
    }
  }
  return out;
}

// ルール: 層とコンテキストの依存方向。
//   infrastructure → 同層のみ（言語拡張基盤：ドメインを知らない）
//   domain  → 同一コンテキスト domain・kernel/domain（＋infrastructure）
//   usecase → 同一コンテキスト {usecase,domain}・kernel/{usecase,domain}（＋infrastructure）
//   adapter → 同一コンテキスト {adapter,usecase,domain}・kernel 全層
// 公認のコンテキスト横断エッジは 1 本のみ（refinement は design/domain へ統合済み）:
//   design/domain → requirements/domain
export const ALLOWED_LAYER_TARGETS: { [k in Layer]: readonly Layer[] } = {
  infrastructure: ["infrastructure"],
  domain: ["domain", "infrastructure"],
  usecase: ["usecase", "domain", "infrastructure"],
  adapter: ["adapter", "usecase", "domain", "infrastructure"],
};

export const SANCTIONED_CROSS_CONTEXT: readonly { from: string; to: string }[] = [
  // refinement/domain は design/domain へ統合された（旧 3 辺は消滅）。design の
  // 型が requirements の識別子・DP をそのまま再輸出するための唯一の横断辺。
  { from: "design/domain", to: "requirements/domain" },
];

export function layerDirection(relPath: string, source: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string") return [];
  const out: Violation[] = [];
  for (const spec of importSpecifiers(source)) {
    // 辺は 2 種——層パッケージの bare specifier（層をまたぐ辺の正規の書き方）と、
    // 解決してから分類する相対 import（実ツリーではパッケージ内に閉じるが、
    // 外へ出た相対も方向を判定し続ける——検出力を二重に持たせる）。node:* と
    // 公認 npm は only-sanctioned-imports の担当なのでここでは見ない。
    const relative = spec.startsWith(".");
    if (!relative && !spec.startsWith(PACKAGE_SCOPE)) continue;
    const target = relative ? resolveRelative(relPath, spec) : spec;
    const targetLoc = relative ? locationOf(target) : packageLocationOf(spec);
    if (targetLoc === null) {
      // 未分類ターゲット（src/ 外への脱出、層に属さないファイル、層パッケージで
      // ない @deep-spec/*）を素通しにすると検査全体の回避経路になるため
      // 違反にする。
      out.push({ path: relPath, rule: "layer-direction", detail: `layered file imports unclassified "${target}"` });
      continue;
    }
    if (typeof targetLoc === "string") {
      out.push({ path: relPath, rule: "layer-direction", detail: `layered file imports non-layered "${target}"` });
      continue;
    }
    const sameOrKernel = targetLoc.context === loc.context || targetLoc.context === "kernel";
    const layerOk = ALLOWED_LAYER_TARGETS[loc.layer].includes(targetLoc.layer);
    const edge = `${loc.context}/${loc.layer}→${targetLoc.context}/${targetLoc.layer}`;
    const sanctioned = SANCTIONED_CROSS_CONTEXT.some(
      (e) => e.from === `${loc.context}/${loc.layer}` && e.to === `${targetLoc.context}/${targetLoc.layer}`,
    );
    if (!(sameOrKernel && layerOk) && !sanctioned) {
      out.push({ path: relPath, rule: "layer-direction", detail: `forbidden edge ${edge} (import "${spec}")` });
    }
  }
  return out;
}

// ルール: 依存「宣言」そのものの方向（FR1.2）。layer-direction が検査するのは
// 書かれた import で、宣言は検査していなかった。しかし isolated linker が張るのは
// package.json の dependencies なので、禁止方向の辺を宣言しただけで——import を
// 一行も書かなくても——構造による強制がそこだけ静かに開く。以後の防衛線は
// テスト時の layer-direction だけに戻り、それはこの分離が終わらせようとした
// 状態そのものである。だから宣言側も import と同じ表で検査し、宣言表と許可表が
// 同じ事実を指すことを固定する。
//
// relPath は src/ からの相対（`<ctx>/<layer>/package.json`）。
const LAYER_PACKAGE_NAME = /^@deep-spec\/([a-z]+)-([a-z]+)$/;

export function manifestDependencyDirection(
  relPath: string,
  manifest: { readonly name?: unknown; readonly dependencies?: unknown },
): Violation[] {
  const rule = "manifest-dependency-direction";
  const out: Violation[] = [];
  const segments = relPath.split("/");
  const context = segments[0] ?? "";
  const layer = segments[1] ?? "";
  if (
    segments.length !== 3 || segments[2] !== "package.json" ||
    !(CONTEXTS as readonly string[]).includes(context) || !(LAYERS as readonly string[]).includes(layer)
  ) {
    return [{ path: relPath, rule, detail: `not a layer package manifest (expected "<context>/<layer>/package.json")` }];
  }
  const expectedName = `@deep-spec/${context}-${layer}`;
  if (manifest.name !== expectedName) {
    out.push({ path: relPath, rule, detail: `name is ${JSON.stringify(manifest.name)} — a layer package is named "${expectedName}"` });
  }
  const declared = manifest.dependencies;
  if (declared !== undefined && (typeof declared !== "object" || declared === null || Array.isArray(declared))) {
    return [...out, { path: relPath, rule, detail: "dependencies is not an object" }];
  }
  const entries = Object.entries((declared ?? {}) as { [k: string]: unknown });
  for (const [spec, version] of entries) {
    const match = LAYER_PACKAGE_NAME.exec(spec);
    const targetContext = match?.[1] ?? "";
    const targetLayer = match?.[2] ?? "";
    if (
      match === null || !(CONTEXTS as readonly string[]).includes(targetContext) ||
      !(LAYERS as readonly string[]).includes(targetLayer)
    ) {
      // 層パッケージ以外を宣言する経路は塞ぐ——合成ルート（@deep-spec/entries）も
      // 未知の名前も、層から辿れる依存にはしない。
      out.push({ path: relPath, rule, detail: `declares "${spec}", which is not a layer package` });
      continue;
    }
    if (version !== "workspace:*") {
      out.push({ path: relPath, rule, detail: `"${spec}" is declared as ${JSON.stringify(version)} — layer edges are "workspace:*"` });
    }
    const edge = `${context}/${layer}→${targetContext}/${targetLayer}`;
    if (targetContext === context && targetLayer === layer) {
      out.push({ path: relPath, rule, detail: `declares itself (${edge})` });
      continue;
    }
    const layerOk = (ALLOWED_LAYER_TARGETS[layer as Layer] as readonly string[]).includes(targetLayer);
    const sameOrKernel = targetContext === context || targetContext === "kernel";
    const sanctioned = SANCTIONED_CROSS_CONTEXT.some(
      (e) => e.from === `${context}/${layer}` && e.to === `${targetContext}/${targetLayer}`,
    );
    if (!(sameOrKernel && layerOk) && !sanctioned) {
      out.push({ path: relPath, rule, detail: `forbidden edge ${edge}` });
    }
  }
  return out;
}

export const ALL_RULES = [
  noTestPayloads,
  onlySanctionedImports,
  noEntryImports,
  noCrossPackageRelativeImports,
  noIoInPureLayers,
  processOnlyInEntries,
  noExportStar,
  layerDirection,
  privateConstructorInDomain,
  noReconstitutionBypass,
  constructionParsingInDomain,
  noGetAccessors,
  noEnums,
  noNonNullAssertions,
  onePublicTypePerFile,
  portsLiveInPortDir,
  commandsReturnVoid,
  noDataModelsInDomain,
  noPrimitiveFieldsInDomain,
  domainFieldsArePrivate,
  publishedLanguageLayers,
] as const;

export function violationsOf(relPath: string, source: string): Violation[] {
  return ALL_RULES.flatMap((rule) => rule(relPath, source));
}
