import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface Node {
  kind: number;
  body?: Node;
  expression?: Node;
  getStart(): number;
  getText(): string;
  forEachChild(visitor: (node: Node) => void): void;
}
interface Source extends Node {
  getLineAndCharacterOfPosition(position: number): { line: number };
}
interface Method {
  path: string;
  className: string;
  name: string;
  start: number;
  end: number;
  codeLines: number;
}
const root = resolve(process.argv[2] ?? process.cwd());
const input: { head: string; top10: Method[] } = JSON.parse(
  readFileSync(join(import.meta.dir, "method-sizes.json"), "utf8"),
);
const temporary = mkdtempSync(join(tmpdir(), "domain-structure-"));
const paths = [...new Set(input.top10.map((method) => method.path))];
const archive = execFileSync("git", ["archive", input.head, ...paths], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
execFileSync("tar", ["-xf", "-", "-C", temporary], { input: archive });
const dependencyRoot = join(root, "deep-spec-analysis/node_modules/typescript/dist");
const { API } = await import(pathToFileURL(join(dependencyRoot, "api/async/api.js")).href);
const { SyntaxKind: K } = await import(pathToFileURL(join(dependencyRoot, "ast/index.js")).href);
const api = new API({ cwd: temporary });
try {
  const config = join(temporary, "tsconfig.json");
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: { noResolve: true, noLib: true, target: "ESNext" },
      files: paths.map((path) => join(temporary, path)),
    }),
  );
  const project = (await api.updateSnapshot({ openProjects: [config] })).getProject(config);
  const measured: object[] = [];
  for (const method of input.top10) {
    const source: Source = await project.program.getSourceFile(join(temporary, method.path));
    let body: Node | undefined;
    const find = (node: Node): void => {
      if (
        node.kind === K.MethodDeclaration &&
        source.getLineAndCharacterOfPosition(node.getStart()).line + 1 === method.start
      )
        body = node.body;
      node.forEachChild(find);
    };
    find(source);
    if (body === undefined) throw new Error(`method body missing: ${method.path}:${method.start}`);
    let ifStatements = 0;
    let ternaries = 0;
    let switches = 0;
    let loops = 0;
    let callbacks = 0;
    let mapSetConstructions = 0;
    let maximumLoopNesting = 0;
    const loopKinds = new Set([K.ForStatement, K.ForInStatement, K.ForOfStatement, K.WhileStatement, K.DoStatement]);
    const walk = (node: Node, loopDepth: number): void => {
      if (node.kind === K.IfStatement) ifStatements++;
      if (node.kind === K.ConditionalExpression) ternaries++;
      if (node.kind === K.SwitchStatement) switches++;
      if (node.kind === K.ArrowFunction || node.kind === K.FunctionExpression || node.kind === K.FunctionDeclaration)
        callbacks++;
      if (node.kind === K.NewExpression && ["Map", "Set"].includes(node.expression?.getText() ?? ""))
        mapSetConstructions++;
      const depth = loopDepth + (loopKinds.has(node.kind) ? 1 : 0);
      if (depth > loopDepth) loops++;
      maximumLoopNesting = Math.max(maximumLoopNesting, depth);
      node.forEachChild((child) => walk(child, depth));
    };
    walk(body, 0);
    measured.push({
      path: method.path,
      method: `${method.className}.${method.name}`,
      start: method.start,
      end: method.end,
      codeLines: method.codeLines,
      ifStatements,
      ternaries,
      switches,
      loops,
      maximumLoopNesting,
      callbacks,
      mapSetConstructions,
    });
  }
  const result = {
    baseline: input.head,
    definition:
      "AST occurrences within each method body, including nested callbacks; not cyclomatic complexity. Map/Set includes every new Map and new Set regardless of key type.",
    measured,
  };
  writeFileSync(join(import.meta.dir, "structure-evidence.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await api.close();
  rmSync(temporary, { recursive: true, force: true });
}
