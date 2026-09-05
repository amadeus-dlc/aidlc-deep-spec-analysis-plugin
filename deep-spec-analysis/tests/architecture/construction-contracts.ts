// ソース上の構築契約の監査。通常の動作検証は公開APIのテストが担い、ここでは
// 例外経路のあるコンストラクタにparseが欠ける構造上の退行を検出する。
function maskLiterals(source: string): string {
  const chars = source.split("");
  let quote = "";
  let comment: "" | "line" | "block" = "";
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === "line") {
      if (char === "\n") comment = "";
      else chars[index] = " ";
      continue;
    }
    if (comment === "block") {
      chars[index] = char === "\n" ? "\n" : " ";
      if (char === "*" && next === "/") {
        chars[++index] = " ";
        comment = "";
      }
      continue;
    }
    if (quote !== "") {
      chars[index] = char === "\n" ? "\n" : " ";
      if (char === "\\") {
        if (index + 1 < source.length) chars[++index] = " ";
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      chars[index] = " ";
      chars[++index] = " ";
      comment = "line";
      continue;
    }
    if (char === "/" && next === "*") {
      chars[index] = " ";
      chars[++index] = " ";
      comment = "block";
      continue;
    }
    if (
      char === "/" &&
      (/[(=,:!?{;]$/.test(source.slice(0, index).trimEnd()) ||
        /\b(?:return|throw|case|yield)\s*$/.test(source.slice(0, index)))
    ) {
      chars[index] = " ";
      let bracket = false;
      for (index++; index < source.length; index++) {
        const part = source[index];
        chars[index] = " ";
        if (part === "\\") {
          if (index + 1 < source.length) chars[++index] = " ";
          continue;
        }
        if (part === "[") bracket = true;
        if (part === "]") bracket = false;
        if (part === "/" && !bracket) break;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      chars[index] = " ";
      quote = char;
    }
  }
  return chars.join("");
}

function closing(source: string, start: number, open: string, close: string): number {
  let depth = 1;
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === open) depth++;
    if (source[index] === close && --depth === 0) return index;
  }
  throw new Error("constructor audit could not parse a balanced declaration");
}

export function missingConstructionParsers(sources: ReadonlyMap<string, string>): readonly string[] {
  const constructors: { path: string; name: string; body: string; parses: boolean }[] = [];
  for (const [path, raw] of sources) {
    if (!path.includes("/domain/")) continue;
    const source = maskLiterals(raw);
    const name = /export class (\w+)/.exec(source)?.[1];
    const constructorMatch = /\bprivate constructor\s*\(/.exec(source);
    if (name === undefined || constructorMatch === null) continue;
    const start = source.indexOf("(", constructorMatch.index);
    const end = closing(source, start, "(", ")");
    const bodyStart = source.indexOf("{", end);
    const bodyEnd = closing(source, bodyStart, "{", "}");
    constructors.push({
      path,
      name,
      body: source.slice(bodyStart + 1, bodyEnd),
      parses: /^\s*(?:public\s+)?static parse\s*(?:<|\()/m.test(source),
    });
  }
  const fallible = new Set(
    constructors.filter((entry) => /\bthrow\b|\bboundedValueSnapshot\s*\(/.test(entry.body)).map((entry) => entry.name),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of constructors) {
      if (fallible.has(entry.name)) continue;
      const dependencies = [...entry.body.matchAll(/\b(\w+)\.of\s*\(/g)].map((match) => match[1]);
      if (dependencies.some((name) => fallible.has(name))) {
        fallible.add(entry.name);
        changed = true;
      }
    }
  }
  return constructors.filter((entry) => fallible.has(entry.name) && !entry.parses).map((entry) => entry.path);
}

export function abbreviatedTypeNames(source: string): readonly string[] {
  const forbidden = new Set([
    "Ir",
    "Br",
    "Fr",
    "Attr",
    "Attrs",
    "Req",
    "Rel",
    "Rels",
    "Decl",
    "Decls",
    "Ref",
    "Refs",
    "Id",
    "Ids",
    "Smt",
    "Itf",
    "Ctx",
    "Def",
    "Defs",
    "Impl",
    "Config",
    "Deps",
    "Enum",
    "Refcheck",
    "Spec",
    "Specs",
    "Md",
    "Ok",
    "Err",
  ]);
  const names = [
    ...maskLiterals(source).matchAll(/^(?:export )?(?:abstract )?(?:class|interface|type) ([A-Z]\w*)/gm),
  ].map((match) => match[1]);
  return names.filter((name) =>
    (name.match(/[A-Z]+(?=[A-Z][a-z]|[0-9]|$)|[A-Z]?[a-z]+|[0-9]+/g) ?? []).some((word) => forbidden.has(word)),
  );
}
