import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? process.cwd());
const plugin = join(root, "deep-spec-analysis");
const output = resolve(process.argv[3] ?? import.meta.dir);
const head = execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const { API } = await import(pathToFileURL(join(plugin, "node_modules/typescript/dist/api/async/api.js")).href);
const ast = await import(pathToFileURL(join(plugin, "node_modules/typescript/dist/ast/index.js")).href);

interface AuditNode {
  kind: number;
  pos: number;
  end: number;
  expression?: AuditNode;
  getStart(): number;
  getEnd(): number;
  getText(): string;
  getFullText(): string;
  forEachChild(visitor: (node: AuditNode) => void): void;
}

interface Source extends AuditNode {
  statements: readonly AuditNode[];
  getLineAndCharacterOfPosition(position: number): { line: number; character: number };
}

interface FileMetrics {
  path: string;
  sha256: string;
  lines: number;
  commentCount: number;
  commentLines: number;
  statements: number;
  functions: number;
  throws: number;
  illegalArgumentThrows: number;
  imports: { line: number; text: string }[];
}

interface Comment {
  path: string;
  start: number;
  end: number;
  line: number;
  endLine: number;
  text: string;
}

function extract(path: string, text: string, source: Source) {
  const chars = text.split("");
  let throws = 0;
  let illegalArgumentThrows = 0;
  let functions = 0;
  const imports: { line: number; text: string }[] = [];
  const visit = (node: AuditNode): void => {
    if ([ast.SyntaxKind.FunctionDeclaration, ast.SyntaxKind.FunctionExpression, ast.SyntaxKind.ArrowFunction,
      ast.SyntaxKind.MethodDeclaration, ast.SyntaxKind.Constructor].includes(node.kind)) functions++;
    // テンプレート全体ではなくrawの各片だけを除く。${}内のコメントは残す。
    if ([ast.SyntaxKind.StringLiteral, ast.SyntaxKind.RegularExpressionLiteral,
      ast.SyntaxKind.NoSubstitutionTemplateLiteral, ast.SyntaxKind.TemplateHead,
      ast.SyntaxKind.TemplateMiddle, ast.SyntaxKind.TemplateTail].includes(node.kind)) {
      for (let position = node.getStart(); position < node.getEnd(); position++) {
        if (chars[position] !== "\n" && chars[position] !== "\r") chars[position] = " ";
      }
    }
    if (node.kind === ast.SyntaxKind.ThrowStatement) {
      throws++;
      if (node.expression?.getText().startsWith("new IllegalArgumentException(")) illegalArgumentThrows++;
    }
    if (node.kind === ast.SyntaxKind.ImportDeclaration) {
      imports.push({line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: node.getText()});
    }
    node.forEachChild(visit);
  };
  visit(source);
  const comments: Comment[] = [...chars.join("").matchAll(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g)].map(match => {
    const start = match.index;
    const end = start + match[0].length;
    return {path, start, end, line: source.getLineAndCharacterOfPosition(start).line + 1,
      endLine: source.getLineAndCharacterOfPosition(end - 1).line + 1, text: text.slice(start, end)};
  });
  const commentLines = new Set<number>();
  for (const comment of comments) for (let line = comment.line; line <= comment.endLine; line++) commentLines.add(line);
  return {comments, commentLines: commentLines.size, statements:source.statements.length, functions, throws, illegalArgumentThrows, imports};
}

const api = new API({cwd: plugin});
const fixture = mkdtempSync(join(tmpdir(), "comment-audit-extractor-"));
try {
  const specimen = '// actual-one\nconst url = "https://host/path";\nconst regexp = /\\/\\* fake \\*\\//;\nconst text = `// fake ${/* actual-two */ 1} /* fake */`;\nfunction empty() { /* actual-three */ }\n/* actual-four */\n';
  const fixtureFile = join(fixture, "sample.ts");
  const fixtureConfig = join(fixture, "tsconfig.json");
  writeFileSync(fixtureFile, specimen);
  writeFileSync(fixtureConfig, JSON.stringify({files:[fixtureFile]}));
  const fixtureProject = (await api.updateSnapshot({openProjects:[fixtureConfig]})).getProject(fixtureConfig);
  const fixtureSource = await fixtureProject?.program.getSourceFile(fixtureFile);
  if (fixtureSource === undefined) throw new Error("fixture source missing");
  const actual = extract("sample.ts", specimen, fixtureSource).comments.map(comment => comment.text);
  const expected = ["// actual-one", "/* actual-two */", "/* actual-three */", "/* actual-four */"];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`extractor mismatch: ${JSON.stringify(actual)}`);

  // HEADのアーカイブだけを計測し、並行編集・コミットが混ざるのを防ぐ。
  const snapshot = join(fixture,"tree");
  mkdirSync(snapshot);
  const archive = execFileSync("git",["archive",head,"deep-spec-analysis/src","deep-spec-analysis/scripts","deep-spec-analysis/tests"],{cwd:root,maxBuffer:32*1024*1024});
  execFileSync("tar",["-xf","-","-C",snapshot],{input:archive});
  const snapshotPlugin = join(snapshot,"deep-spec-analysis");
  const config = join(snapshotPlugin, "tsconfig.json");
  writeFileSync(config,JSON.stringify({compilerOptions:{noResolve:true,noLib:true,target:"ESNext",module:"ESNext"},include:["src/**/*.ts","scripts/**/*.ts","tests/**/*.ts"]}));
  const project = (await api.updateSnapshot({openProjects:[config]})).getProject(config);
  if (project === undefined) throw new Error("project missing");
  const paths = execFileSync("rg", ["--files", "src", "scripts", "tests", "-g", "*.ts", "-g", "!tests/fixtures/**"], {cwd:snapshotPlugin,encoding:"utf8"}).trim().split("\n").sort();
  const files: FileMetrics[] = [];
  const all: Comment[] = [];
  for (const path of paths) {
    const source = await project.program.getSourceFile(join(snapshotPlugin, path));
    if (source === undefined) throw new Error(`source missing: ${path}`);
    const errors = await project.program.getSyntacticDiagnostics(join(snapshotPlugin, path));
    if (errors.length > 0) throw new Error(`invalid source: ${path}`);
    const text = source.getFullText();
    const data = extract(path, text, source);
    all.push(...data.comments);
    const {comments, ...metrics} = data;
    files.push({path, sha256:createHash("sha256").update(text).digest("hex"), lines:text.trimEnd().split("\n").length, commentCount:comments.length, ...metrics});
  }
  const summary = ["src/", "scripts/", "tests/"].map(prefix => {
    const selected = files.filter(file => file.path.startsWith(prefix));
    return {prefix, files:selected.length,
      comments:selected.reduce((n,file)=>n+file.commentCount,0),
      commentLines:selected.reduce((n,file)=>n+file.commentLines,0),
      lines:selected.reduce((n,file)=>n+file.lines,0)};
  });
  mkdirSync(output,{recursive:true});
  writeFileSync(join(output,"inventory.json"),JSON.stringify({head,extractorFixture:"4 actual comments; quoted/regex/template raw text excluded",summary,files,comments:all},null,2)+"\n");
  console.log(JSON.stringify(summary));
} finally {
  await api.close();
  rmSync(fixture,{recursive:true,force:true});
}
