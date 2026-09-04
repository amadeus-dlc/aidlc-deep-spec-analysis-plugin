// 決定論的 YAML サブセットパーサ。エラー文言は refcheck findings の detail
// として golden バイトに現れるため逐語凍結。deep-spec-lib.ts からの逐語移動。
//
// Supports: block mappings, block sequences, plain/quoted scalars, inline
// arrays [a, b], literal (|) and folded (>) blocks, full-line and trailing
// comments. Rejects anchors (&), aliases (*), tags (!), and flow maps ({})
// as "unsupported YAML feature" — out-of-subset input is an error, never an
// interpretation guess (NFR: deterministic parsing).

import { type Json } from "@deep-spec/kernel-infrastructure";

export type Yaml = Json;

interface YamlLine {
  indent: number;
  text: string;
  n: number;
}

class YamlError extends Error {
  // 既定コンストラクタのままだと bun のカバレッジ計測が「未実行の関数」として
  // 数えてしまう（実際は throw 経路で毎回実行される）ため明示する。挙動は不変。
  constructor(message: string) {
    super(message);
  }
}

export function parseYamlSubset(src: string): { value?: Yaml; error?: string } {
  const raw = src.split("\n");
  const lines: YamlLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const expanded = (raw[i] ?? "").replace(/\t/g, "  ");
    const trimmed = expanded.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    lines.push({ indent: expanded.length - expanded.trimStart().length, text: trimmed, n: i + 1 });
  }
  if (lines.length === 0) return { value: null };
  try {
    const [value, next] = parseBlock(lines, 0, lines[0]?.indent ?? 0);
    if (next < lines.length) {
      throw new YamlError(`line ${lines[next]?.n}: content outside the top-level block`);
    }
    return { value };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function parseBlock(lines: YamlLine[], start: number, indent: number): [Yaml, number] {
  const first = lines[start];
  if (!first) return [null, start];
  if (first.text === "-" || first.text.startsWith("- ")) {
    return parseSequence(lines, start, indent);
  }
  return parseMapping(lines, start, indent);
}

function parseSequence(lines: YamlLine[], start: number, indent: number): [Yaml, number] {
  const out: Yaml[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent !== indent || !(line.text === "-" || line.text.startsWith("- "))) break;
    const rest = line.text === "-" ? "" : line.text.slice(2).trim();
    if (rest === "") {
      const next = lines[i + 1];
      if (next && next.indent > indent) {
        const [child, ni] = parseBlock(lines, i + 1, next.indent);
        out.push(child);
        i = ni;
      } else {
        out.push(null);
        i++;
      }
      continue;
    }
    if (isMappingEntry(rest)) {
      // `- key: value` — an inline mapping start; fold the inline part in as a
      // virtual line and consume the deeper continuation lines.
      const virtual: YamlLine = { indent: indent + 2, text: rest, n: line.n };
      const sub: YamlLine[] = [virtual];
      let j = i + 1;
      while (j < lines.length && (lines[j]?.indent ?? 0) > indent) {
        sub.push(lines[j] as YamlLine);
        j++;
      }
      const [child] = parseMapping(sub, 0, indent + 2);
      out.push(child);
      i = j;
      continue;
    }
    out.push(parseScalar(rest, line.n));
    i++;
  }
  return [out, i];
}

function isMappingEntry(text: string): boolean {
  if (text.startsWith("[") || text.startsWith("'") || text.startsWith('"')) return false;
  return /^[^:]+:(\s|$)/.test(text);
}

function parseMapping(lines: YamlLine[], start: number, indent: number): [Yaml, number] {
  const out: { [k: string]: Yaml } = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent !== indent) break;
    if (line.text === "-" || line.text.startsWith("- ")) break;
    const m = line.text.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m) throw new YamlError(`line ${line.n}: not a mapping entry: "${line.text}"`);
    const key = unquote((m[1] ?? "").trim());
    const valPart = (m[2] ?? "").trim();
    if (valPart === "") {
      const next = lines[i + 1];
      if (next && next.indent > indent) {
        const [child, ni] = parseBlock(lines, i + 1, next.indent);
        out[key] = child;
        i = ni;
      } else {
        out[key] = null;
        i++;
      }
      continue;
    }
    if (/^[>|][+-]?$/.test(valPart)) {
      const parts: string[] = [];
      let j = i + 1;
      while (j < lines.length && (lines[j]?.indent ?? 0) > indent) {
        parts.push(lines[j]?.text ?? "");
        j++;
      }
      out[key] = parts.join(valPart.startsWith(">") ? " " : "\n");
      i = j;
      continue;
    }
    out[key] = parseScalar(valPart, line.n);
    i++;
  }
  return [out, i];
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseScalar(s: string, lineNo: number): Yaml {
  let v = s;
  if (v.startsWith("&") || v.startsWith("*") || v.startsWith("!")) {
    throw new YamlError(`line ${lineNo}: unsupported YAML feature (anchor/alias/tag): "${v}"`);
  }
  if (v.startsWith("{")) {
    throw new YamlError(`line ${lineNo}: unsupported YAML feature (flow mapping): "${v}"`);
  }
  if (v.startsWith('"') || v.startsWith("'")) {
    const quote = v[0] as string;
    const close = v.indexOf(quote, 1);
    if (close > 0) return v.slice(1, close);
    throw new YamlError(`line ${lineNo}: unterminated quoted scalar: "${v}"`);
  }
  const hash = v.indexOf(" #");
  if (hash >= 0) v = v.slice(0, hash).trim();
  if (v.startsWith("[")) {
    if (!v.endsWith("]")) throw new YamlError(`line ${lineNo}: unterminated inline sequence: "${v}"`);
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => parseScalar(item.trim(), lineNo));
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  if (/^-?[0-9]+$/.test(v)) return Number.parseInt(v, 10);
  if (/^-?[0-9]+\.[0-9]+$/.test(v)) return Number.parseFloat(v);
  return v;
}
