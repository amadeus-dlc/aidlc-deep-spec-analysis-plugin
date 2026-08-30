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
export const LEGACY_FILES: ReadonlySet<string> = new Set([
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

// 合成ルート（フラット必須の entry）。ディスパッチャが basename 解決するため
// tools/ 直下から動かせない。
export const ENTRY_FILES: ReadonlySet<string> = new Set(
  [...LEGACY_FILES].filter((f) => f.startsWith("aidlc-sensor-") || f === "deep-spec-analysis-doctor.ts"),
);

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
  if (LEGACY_FILES.has(relPath)) return ENTRY_FILES.has(relPath) ? "entry" : "legacy";
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
] as const;

export function violationsOf(relPath: string, source: string): Violation[] {
  return ALL_RULES.flatMap((rule) => rule(relPath, source));
}
