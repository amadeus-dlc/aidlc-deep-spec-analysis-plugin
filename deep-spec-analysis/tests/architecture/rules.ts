// アーキテクチャルール — tools/ 配下の import 方向と層規律を検査する純粋関数群。
//
// 各ルールは (tools/ からの相対パス, ソーステキスト) を受けて違反を返す。
// テスト側は必ず red example（違反を検出できることの証明）と green example を
// 先に流してから実ツリーへ適用する（カスタム検査の DoD）。
//
// 現行のフラット 13 ファイルは LEGACY 扱いで層規律の対象外。移行 PR が
// 進むたびに LEGACY 集合が縮み、PR10 で空になる（issue #23）。

export interface Violation {
  readonly path: string;
  readonly rule: string;
  readonly detail: string;
}

// 移行前から存在するフラット構成のファイル。層規律（process/io/方向）を免除。
// 削除されたらこの集合からも消すこと（増やす変更は移行の逆行）。
// 合成ルート（フラット必須の entry）。ディスパッチャが basename 解決するため
// tools/ 直下から動かせない。層規律の免除ではなく「配線だけを持つ役割」で、
// process.*/import.meta を許される唯一の場所。旧 LEGACY_FILES 免除は PR10 で
// 空化された——entry 以外のフラットファイルは未分類として違反になる。
export const ENTRY_FILES: ReadonlySet<string> = new Set([
  "aidlc-sensor-deep-spec-ir-valid.ts",
  "aidlc-sensor-deep-spec-verify-smt.ts",
  "aidlc-sensor-deep-spec-verify-quint.ts",
  "aidlc-sensor-deep-spec-refcheck-domain.ts",
  "aidlc-sensor-deep-spec-refcheck-contract.ts",
  "aidlc-sensor-deep-spec-refcheck-functional.ts",
  "aidlc-sensor-deep-spec-design-ir-valid.ts",
  "aidlc-sensor-deep-spec-design-verify-smt.ts",
  "aidlc-sensor-deep-spec-design-verify-quint.ts",
  "deep-spec-analysis-doctor.ts",
]);

const CONTEXTS = ["kernel", "requirements", "design", "refinement", "refcheck", "doctor"] as const;
// infrastructure は「言語を拡張する技術基盤」専用の最内層（オーナー裁定
// 2026-08-30）：手巻き Result 等、ユビキタス言語でない純基盤を置く。
// RPC クライアント・永続化は置かない——それらは adapter のゲートウェイ責務。
const LAYERS = ["infrastructure", "domain", "usecase", "adapter"] as const;

type Layer = (typeof LAYERS)[number];

interface Location {
  readonly context: string;
  readonly layer: Layer;
}

export function locationOf(relPath: string): Location | "entry" | "legacy" | "data" | null {
  if (ENTRY_FILES.has(relPath)) return "entry";
  const segments = relPath.split("/");
  if (segments[0] === "data") return "data";
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

function resolveRelative(fromRelPath: string, specifier: string): string {
  const base = fromRelPath.split("/").slice(0, -1);
  for (const seg of specifier.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") base.pop();
    else base.push(seg);
  }
  return base.join("/");
}

// ルール: tools/ にテストペイロードを置かない（validator/compose の双方が拒否・drop する）。
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

// ルール: 外部依存を持ち込まない。許されるのは node:* / 相対 import /
// 公認の optional 依存（z3-solver の動的 import）のみ。
const ALLOWED_NPM: ReadonlySet<string> = new Set(["z3-solver"]);

export function onlySanctionedImports(relPath: string, source: string): Violation[] {
  const out: Violation[] = [];
  for (const spec of importSpecifiers(source)) {
    const sanctioned = spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../") || ALLOWED_NPM.has(spec);
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

// ルール: domain 層にデータモデルを置かない（主従の裁定・MECE フェンス
// 2026-09-01、#71）。getter しかない型（property-only interface・object 型
// エイリアス・record を含む共用体）はデータモデルであり、domain 層の住人では
// ない——命令できる class へ反転するか、ドア署名の無名インライン引数へ解散
// する。DATA_MODEL_DEBT は着手時の全数棚卸し（縮小専用——増やす変更は裁定
// 違反で、波が 1 件返すたびにここから消す。LEGACY_FILES と同じ規律）。
// Expression は寛容 published language の既裁定で恒久除外。
export const DATA_MODEL_DEBT: ReadonlySet<string> = new Set([
  "design/domain/design-background-assumption.ts",
  "design/domain/design-background-decl.ts",
  "design/domain/design-cross-checked-entry.ts",
  "design/domain/design-entity-decl.ts",
  "design/domain/design-finding.ts",
  "design/domain/design-ignore-decl.ts",
  "design/domain/design-ignore.ts",
  "design/domain/design-input-anchor.ts",
  "design/domain/design-ir-validation-materials-seed.ts",
  "design/domain/design-machine-decl.ts",
  "design/domain/design-machine.ts",
  "design/domain/design-model-composition.ts",
  "design/domain/design-report-composition.ts",
  "design/domain/design-report-seed.ts",
  "design/domain/design-skipped.ts",
  "design/domain/design-transition.ts",
  "design/domain/design-unit-decl.ts",
  "design/domain/design-unit-seed.ts",
  "design/domain/design-value.ts",
  "design/domain/lowered-background.ts",
  "design/domain/lowered-obligation.ts",
  "design/domain/lowered-origin.ts",
  "design/domain/lowered-scenario.ts",
  "design/domain/remapped-unit.ts",
  "design/domain/sibling-verdict-document.ts",
  "design/domain/sibling-verdict-finding.ts",
  "design/domain/sibling-verdict-skip.ts",
  "doctor/domain/check.ts",
  "doctor/domain/coverage-row.ts",
  "doctor/domain/debt-row.ts",
  "doctor/domain/digest-anchor.ts",
  "doctor/domain/installed-status.ts",
  "doctor/domain/manifest-entry.ts",
  "doctor/domain/refinement-stale-row.ts",
  "doctor/domain/solver-availability.ts",
  "doctor/domain/unit-coverage-row.ts",
  "refcheck/domain/attr-decl-seed.ts",
  "refcheck/domain/component-catalog-outcome.ts",
  "refcheck/domain/component-check-materials-seed.ts",
  "refcheck/domain/component-entity.ts",
  "refcheck/domain/component-ref.ts",
  "refcheck/domain/component-shape-error.ts",
  "refcheck/domain/component.ts",
  "refcheck/domain/contract-check-materials-seed.ts",
  "refcheck/domain/contract-row.ts",
  "refcheck/domain/contracts-table-outcome.ts",
  "refcheck/domain/declared-entities-seed.ts",
  "refcheck/domain/declared-units-outcome.ts",
  "refcheck/domain/design-record-seed.ts",
  "refcheck/domain/domain-entities-outcome.ts",
  "refcheck/domain/domain-entity-sketch-seed.ts",
  "refcheck/domain/entities-outcome.ts",
  "refcheck/domain/entity-decl-seed.ts",
  "refcheck/domain/entity-reference.ts",
  "refcheck/domain/finding.ts",
  "refcheck/domain/functional-check-materials-seed.ts",
  "refcheck/domain/functional-spec-outcome.ts",
  "refcheck/domain/input-anchor.ts",
  "refcheck/domain/reference-check-report-seed.ts",
  "refcheck/domain/rel-decl-seed.ts",
  "refcheck/domain/rule-decl-seed.ts",
  "refcheck/domain/rules-outcome.ts",
  "refcheck/domain/shape-error.ts",
  "refcheck/domain/skipped.ts",
  "refcheck/domain/spec-block-assessment.ts",
  "refcheck/domain/state-machine-sketch-seed.ts",
  "refcheck/domain/unit-decl.ts",
  "refcheck/domain/witness-ref.ts",
  "refinement/domain/attribute-mapping.ts",
  "refinement/domain/design-event.ts",
  "refinement/domain/event-mapping.ts",
  "refinement/domain/interpreted-refinement-verdicts.ts",
  "refinement/domain/ref-token-carrier.ts",
  "refinement/domain/refinement-attribute.ts",
  "refinement/domain/refinement-map-acquisition.ts",
  "refinement/domain/refinement-map-seed.ts",
  "refinement/domain/refinement-probe.ts",
  "refinement/domain/refinement-quint-invariant.ts",
  "refinement/domain/refinement-requirements-seed.ts",
  "refinement/domain/refinement-status.ts",
  "refinement/domain/refinement-unit-map.ts",
  "refinement/domain/unmapped-target.ts",
  "requirements/domain/attribute-declaration.ts",
  "requirements/domain/background-assumption.ts",
  "requirements/domain/cross-checked-entry.ts",
  "requirements/domain/decoded-value.ts",
  "requirements/domain/fr-ref-claim.ts",
  "requirements/domain/interpreted-quint-verdicts.ts",
  "requirements/domain/interpreted-verdicts.ts",
  "requirements/domain/ir-background-decl.ts",
  "requirements/domain/ir-entity-decl.ts",
  "requirements/domain/ir-model-decl-seed.ts",
  "requirements/domain/ir-temporal-decl.ts",
  "requirements/domain/ir-validation-materials-seed.ts",
  "requirements/domain/quint-machine-component.ts",
  "requirements/domain/quint-machine-facts-seed.ts",
  "requirements/domain/quint-machine-run-verdict.ts",
  "requirements/domain/quint-runs-seed.ts",
  "requirements/domain/quint-scenario-verdict.ts",
  "requirements/domain/quint-temporal-verdict.ts",
  "requirements/domain/requirements-model-seed.ts",
  "requirements/domain/requirements-source-seed.ts",
  "requirements/domain/smt-event-pair-probe.ts",
  "requirements/domain/smt-plan-facts-seed.ts",
  "requirements/domain/trace-state.ts",
  "requirements/domain/verification-finding.ts",
  "requirements/domain/verification-report-composition.ts",
  "requirements/domain/verification-report-seed.ts",
  "requirements/domain/verification-skipped.ts",
  "requirements/domain/verification-witness.ts",
]);

export function noDataModelsInDomain(relPath: string, rawSource: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string" || loc.layer !== "domain") return [];
  if (DATA_MODEL_DEBT.has(relPath)) return [];
  const source = stripStrings(rawSource);
  const out: Violation[] = [];
  for (const m of source.matchAll(/^export interface (\w+)\s*(?:extends [\w<>, ]+)?\{([\s\S]*?)^\}/gm)) {
    const name = m[1] ?? "";
    if (name === "Expression") continue;
    if (!/^\s+\w+\([^)]*\):/m.test(m[2] ?? "")) {
      out.push({ path: relPath, rule: "no-data-models-in-domain", detail: `getter-only interface ${name} is a data model — make it commandable or dissolve it into a door signature` });
    }
  }
  for (const m of source.matchAll(/^export type (\w+)\s*=\s*([\s\S]*?);\n/gm)) {
    const rhs = m[2] ?? "";
    if (/^\s*\{/.test(rhs) || (rhs.includes("{") && rhs.includes("|"))) {
      out.push({ path: relPath, rule: "no-data-models-in-domain", detail: `record-shaped type alias ${m[1]} is a data model — make it commandable or dissolve it into a door signature` });
    }
  }
  return out;
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
// 公認のコンテキスト横断エッジは 2 本のみ:
//   refinement/domain → {requirements,design}/domain
//   design/usecase    → refinement/domain
const ALLOWED_LAYER_TARGETS: { [k in Layer]: readonly Layer[] } = {
  infrastructure: ["infrastructure"],
  domain: ["domain", "infrastructure"],
  usecase: ["usecase", "domain", "infrastructure"],
  adapter: ["adapter", "usecase", "domain", "infrastructure"],
};

const SANCTIONED_CROSS_CONTEXT: readonly { from: string; to: string }[] = [
  { from: "refinement/domain", to: "requirements/domain" },
  { from: "refinement/domain", to: "design/domain" },
  { from: "design/usecase", to: "refinement/domain" },
  // design のポート Impl（第 2 SMT コンパイラ・refinement 取得系）は
  // refinement 語彙で通信する——ユースケースが公認消費する語彙の実装面。
  { from: "design/adapter", to: "refinement/domain" },
];

export function layerDirection(relPath: string, source: string): Violation[] {
  const loc = locationOf(relPath);
  if (loc === null || typeof loc === "string") return [];
  const out: Violation[] = [];
  for (const spec of importSpecifiers(source)) {
    if (!spec.startsWith(".")) continue;
    const target = resolveRelative(relPath, spec);
    const targetLoc = locationOf(target);
    if (targetLoc === null) {
      // 未分類ターゲット（tools/ 外への脱出や層に属さないファイル）を
      // 素通しにすると検査全体の回避経路になるため違反にする。
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

export const ALL_RULES = [
  noTestPayloads,
  onlySanctionedImports,
  noEntryImports,
  noIoInPureLayers,
  processOnlyInEntries,
  noExportStar,
  layerDirection,
  privateConstructorInDomain,
  noGetAccessors,
  noEnums,
  noNonNullAssertions,
  onePublicTypePerFile,
  portsLiveInPortDir,
  commandsReturnVoid,
  noDataModelsInDomain,
] as const;

export function violationsOf(relPath: string, source: string): Violation[] {
  return ALL_RULES.flatMap((rule) => rule(relPath, source));
}
