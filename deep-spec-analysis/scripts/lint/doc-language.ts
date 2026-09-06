// Markdown の言語規律。1 つのファイルの散文は 1 つの言語で書く。
//
// 規則:
//   - `*.ja.md` 以外の Markdown は日本語の散文を含まない。
//   - `*.ja.md` は日本語の散文を含む（英語のまま置かれた未翻訳の器を検出する）。
//
// この検査が見るのは日本語の有無だけで、任意の言語の混在は判定しない。この repo の
// 文書は英語版 `<name>.md` と日本語版 `<name>.ja.md` の対で持つので、守りたいのは
// その 2 言語の分離である。
//
// 「散文」はフェンス付きコードブロックとインラインコードを除いた本文を指す。両方の
// 規則がこの同じ定義で判定される——`.ja.md` も除去後の本文で見るので、コードの中に
// しか日本語が無い未翻訳の器は違反として残る。
//
// このリポジトリのソースコメントは日本語なので、英語の文書がそれを逐語で引用する
// ことは正当であり、コードとして囲まれている限り違反にしない。
//
// 判定は仮名（ひらがな・カタカナ・半角カタカナ）の有無で行う。漢字だけの語
// （「設計規則」など）は中国語との区別がつかず、英語の文書に技術用語として
// 現れうるため見ない。日本語の散文は実際には必ず仮名を伴うので、ファイル単位では
// これで足りる。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** 走査から外すディレクトリ。生成物と依存は対象にしない。 */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(["node_modules", ".git", "tools", "dist"]);

/**
 * 言語規律の対象外にするパスの接頭辞（パッケージルートからの相対、`/` 区切り）。
 * 免除は表にする——暗黙の除外や名前の部分一致による例外を作らない。
 *
 * `tests/fixtures/` はテストの入力データであって文書ではない。要件文書の
 * サンプルとして日本語の本文を持つことが仕様そのものなので、言語規律を課さない。
 */
const EXEMPT_PREFIXES: readonly string[] = ["tests/fixtures/"];

/** ひらがな・カタカナ・半角カタカナ。漢字は含めない（上のコメント参照）。 */
const JAPANESE_KANA = /[぀-ゟ゠-ヿｦ-ﾟ]/u;

export type DocLanguageRule = "japanese-in-english-doc" | "no-japanese-in-ja-doc";

export interface DocLanguageDiagnostic {
  readonly rule: DocLanguageRule;
  /** パッケージルートからの相対パス（`/` 区切り）。 */
  readonly path: string;
  /** 違反を示す最初の行（1 始まり）。`no-japanese-in-ja-doc` では 0。 */
  readonly line: number;
  /** その行の抜粋（最大 120 文字）。行を持たない違反では空文字。 */
  readonly excerpt: string;
}

export interface DocLanguageReport {
  readonly checkedFiles: number;
  readonly diagnostics: readonly DocLanguageDiagnostic[];
}

/**
 * フェンス付きコードブロックを空行へ落とす。開始フェンスの文字と長さを覚え、
 * 同じ文字で開始以上の長さのフェンスだけを終端として受け付ける（CommonMark）。
 * 行数と行の対応は保つ。
 */
function stripFences(markdown: string): string {
  const out: string[] = [];
  let fenceChar: string | null = null;
  let fenceLength = 0;
  for (const line of markdown.split("\n")) {
    if (fenceChar === null) {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (opening?.[1] !== undefined) {
        fenceChar = opening[1][0] ?? "`";
        fenceLength = opening[1].length;
        out.push("");
        continue;
      }
      out.push(line);
      continue;
    }
    const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
    if (closing?.[1] !== undefined && closing[1][0] === fenceChar && closing[1].length >= fenceLength) {
      fenceChar = null;
      fenceLength = 0;
    }
    out.push("");
  }
  return out.join("\n");
}

/**
 * インラインコードスパンを取り除く。N 個のバッククォートで開いたスパンは、
 * ちょうど N 個の並びで閉じる（CommonMark）。スパンは行をまたぎうるので、
 * 取り除いた範囲の改行だけは残して行番号の対応を保つ。閉じないバッククォート
 * はコードではないので、そのまま散文として残す。
 */
function stripInlineCode(text: string): string {
  const out: string[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "`") {
      out.push(text[index] ?? "");
      index++;
      continue;
    }
    let run = 0;
    while (text[index + run] === "`") run++;

    let scan = index + run;
    let closing = -1;
    while (scan < text.length) {
      if (text[scan] !== "`") {
        scan++;
        continue;
      }
      let candidate = 0;
      while (text[scan + candidate] === "`") candidate++;
      if (candidate === run) {
        closing = scan;
        break;
      }
      scan += candidate;
    }

    if (closing === -1) {
      out.push("`".repeat(run));
      index += run;
      continue;
    }
    for (let position = index; position < closing + run; position++) if (text[position] === "\n") out.push("\n");
    index = closing + run;
  }
  return out.join("");
}

/** フェンスとインラインコードを取り除いた散文を返す。行番号の対応は保つ。 */
export function stripCode(markdown: string): string {
  return stripInlineCode(stripFences(markdown));
}

function isExempt(relativePath: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function markdownFilesUnder(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      if (SKIPPED_DIRECTORIES.has(entry)) continue;
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) walk(absolute);
      else if (entry.endsWith(".md")) found.push(absolute);
    }
  };
  walk(root);
  return found;
}

function firstJapaneseLine(prose: string): { line: number; excerpt: string } | null {
  const lines = prose.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (JAPANESE_KANA.test(line)) return { line: index + 1, excerpt: line.trim().slice(0, 120) };
  }
  return null;
}

/** パッケージルート配下の Markdown を検査する。 */
export function lintDocLanguage(root: string): DocLanguageReport {
  const diagnostics: DocLanguageDiagnostic[] = [];
  let checkedFiles = 0;

  for (const absolute of markdownFilesUnder(root)) {
    const relativePath = relative(root, absolute).split(sep).join("/");
    if (isExempt(relativePath)) continue;
    checkedFiles++;

    const prose = stripCode(readFileSync(absolute, "utf-8"));
    if (relativePath.endsWith(".ja.md")) {
      if (!JAPANESE_KANA.test(prose))
        diagnostics.push({ rule: "no-japanese-in-ja-doc", path: relativePath, line: 0, excerpt: "" });
      continue;
    }

    const hit = firstJapaneseLine(prose);
    if (hit !== null)
      diagnostics.push({
        rule: "japanese-in-english-doc",
        path: relativePath,
        line: hit.line,
        excerpt: hit.excerpt,
      });
  }

  return { checkedFiles, diagnostics };
}
