import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2]);
const revision = process.argv[3] ?? "origin/main";
const output = resolve(process.argv[4] ?? "/tmp/domain-cohesion-measurement");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const head = git("rev-parse", revision).trim();
const dependencyRoot = join(root, "deep-spec-analysis/node_modules/typescript/dist");
const { API } = await import(pathToFileURL(join(dependencyRoot, "api/async/api.js")).href);
const { SyntaxKind: K } = await import(pathToFileURL(join(dependencyRoot, "ast/index.js")).href);
const tree = join(output, head);
mkdirSync(tree, { recursive: true });
const archive = execFileSync("git", ["archive", head, "deep-spec-analysis/src"], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
execFileSync("tar", ["-xf", "-", "-C", tree], { input: archive });
const paths = git("ls-tree", "-r", "--name-only", head, "deep-spec-analysis/src").trim().split("\n")
  .filter(path => /^deep-spec-analysis\/src\/[^/]+\/domain\/.*\.ts$/.test(path));

interface Node {
  kind: number;
  name?: Node;
  body?: Node;
  initializer?: Node;
  modifiers?: readonly Node[];
  members?: readonly Node[];
  getStart(): number;
  getEnd(): number;
  getText(): string;
  getFullText(): string;
  forEachChild(visitor: (node: Node) => void): void;
}
interface Source extends Node {
  getLineAndCharacterOfPosition(position: number): { line: number };
}
interface Method {
  path: string;
  className: string;
  name: string;
  kind: string;
  static: boolean;
  start: number;
  end: number;
  bodyStart: number;
  codeLines: number;
  spanLines: number;
  codeLineNumbers: number[];
}

function measure(source: Source, path: string): Method[] {
  const text = source.getFullText();
  const masked = text.split("");
  const literalKinds = new Set([K.StringLiteral, K.RegularExpressionLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail]);
  const maskLiterals = (node: Node): void => {
    if (literalKinds.has(node.kind)) {
      for (let i = node.getStart(); i < node.getEnd(); i++) if (masked[i] !== "\n" && masked[i] !== "\r") masked[i] = " ";
    }
    node.forEachChild(maskLiterals);
  };
  maskLiterals(source);
  const code = text.split("");
  for (const match of masked.join("").matchAll(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g)) {
    for (let i = match.index; i < match.index + match[0].length; i++) if (code[i] !== "\n" && code[i] !== "\r") code[i] = " ";
  }
  const clean = code.join("");
  const result: Method[] = [];
  const memberKinds = new Set([K.MethodDeclaration, K.Constructor, K.GetAccessor, K.SetAccessor]);
  const visit = (node: Node): void => {
    if (node.kind === K.ClassDeclaration || node.kind === K.ClassExpression) {
      for (const member of node.members ?? []) {
        const callableProperty = member.kind === K.PropertyDeclaration &&
          (member.initializer?.kind === K.ArrowFunction || member.initializer?.kind === K.FunctionExpression);
        if (!memberKinds.has(member.kind) && !callableProperty) continue;
        const body = callableProperty ? member.initializer?.body : member.body;
        if (body === undefined) continue;
        const block = body.kind === K.Block;
        const start = body.getStart() + (block ? 1 : 0);
        const end = body.getEnd() - (block ? 1 : 0);
        const firstLine = source.getLineAndCharacterOfPosition(start).line + 1;
        const codeLineNumbers = clean.slice(start, end).split("\n")
          .map((line, i) => line.trim().length > 0 ? firstLine + i : null)
          .filter((line): line is number => line !== null);
        result.push({
          path,
          className: node.name?.getText() ?? "<anonymous>",
          name: member.kind === K.Constructor ? "constructor" : member.name?.getText() ?? "<anonymous>",
          kind: callableProperty ? "callable-property" : member.kind === K.Constructor ? "constructor" : "method",
          static: member.modifiers?.some(modifier => modifier.kind === K.StaticKeyword) ?? false,
          start: source.getLineAndCharacterOfPosition(member.getStart()).line + 1,
          end: source.getLineAndCharacterOfPosition(member.getEnd() - 1).line + 1,
          bodyStart: source.getLineAndCharacterOfPosition(body.getStart()).line + 1,
          codeLines: codeLineNumbers.length,
          spanLines: source.getLineAndCharacterOfPosition(member.getEnd() - 1).line - source.getLineAndCharacterOfPosition(member.getStart()).line + 1,
          codeLineNumbers,
        });
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return result;
}

const fixturePath = join(tree, "fixture.ts");
writeFileSync(fixturePath, [
  "class Fixture {",
  "  constructor(",
  "    value: string,",
  "  ) { this.value = value; }",
  "  measure(",
  "    flag: boolean,",
  "  ) {",
  "    // comment",
  '    const url = "https://example.org/*data*/";',
  "    const pattern = /\\/\\*data\\*\\//;",
  "    const template = `//data ${/*comment*/ 1}`;",
  "    /* multiline",
  "       comment */",
  "",
  "    if (flag) {",
  "      return { url, pattern, template }; // comment",
  "    }",
  "    return null;",
  "  }",
  "  static empty() { /*comment*/ }",
  "  callback = () => 42;",
  "}",
].join("\n"));
const config = join(tree, "tsconfig.json");
writeFileSync(config, JSON.stringify({ compilerOptions: { noResolve: true, noLib: true, target: "ESNext", module: "ESNext" }, files: [fixturePath, ...paths.map(path => join(tree, path))] }));
const api = new API({ cwd: tree });
try {
  const project = (await api.updateSnapshot({ openProjects: [config] })).getProject(config);
  const fixture = await project.program.getSourceFile(fixturePath);
  const check = measure(fixture, "fixture.ts").map(method => [method.name, method.codeLines]);
  if (JSON.stringify(check) !== JSON.stringify([["constructor", 1], ["measure", 7], ["empty", 0], ["callback", 1]])) throw new Error(`fixture failed: ${JSON.stringify(check)}`);
  const methods: Method[] = [];
  const fileHashes: Record<string, string> = {};
  for (const path of paths) {
    const absolute = join(tree, path);
    const errors = await project.program.getSyntacticDiagnostics(absolute);
    if (errors.length > 0) throw new Error(`syntax errors: ${path}`);
    const source = await project.program.getSourceFile(absolute);
    if (!source) throw new Error(`missing source: ${path}`);
    methods.push(...measure(source, path));
    fileHashes[path] = createHash("sha256").update(readFileSync(absolute)).digest("hex");
  }
  const ranked = methods.filter(method => method.codeLines >= 5).sort((a, b) => b.codeLines - a.codeLines || a.path.localeCompare(b.path) || a.start - b.start);
  const result = { head, files: paths.length, methods: methods.length, eligible: ranked.length, definition: "Class callable bodies including constructors and static methods; exclude signatures, outer braces, empty lines and comments; include nested callbacks and inner delimiter-only lines. Top-level functions excluded.", fixture: check, ranked, fileHashes };
  writeFileSync(join(output, "results.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ head, files: paths.length, methods: methods.length, eligible: ranked.length, top10: ranked.slice(0, 10).map(({codeLineNumbers, ...method}) => method) }, null, 2));
} finally {
  await api.close();
}
