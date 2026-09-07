import { relative } from "node:path";
import * as ast from "typescript/unstable/ast";

export const CHILD_PROCESS_MODULES = new Set(["child_process", "node:child_process"]);
export const FILESYSTEM_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"]);
export const KERNEL_INFRASTRUCTURE_MODULE = "@deep-spec-analysis/kernel-infrastructure";
export const PROCESS_APIS = new Set(["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]);
export const FILESYSTEM_READ_APIS = new Set([
  "readFile",
  "readFileSync",
  "readdir",
  "readdirSync",
  "stat",
  "statSync",
  "lstat",
  "lstatSync",
  "realpath",
  "realpathSync",
  "open",
  "openSync",
  "access",
  "accessSync",
]);
export const OUTPUT_MATCH_APIS = new Set([
  "includes",
  "indexOf",
  "lastIndexOf",
  "match",
  "search",
  "startsWith",
  "endsWith",
]);
export const ERROR_WORDS = /error|deadlock|fail|violation/i;

export function isTargetSource(path: string, root: string): boolean {
  const normalized = relative(root, path).replaceAll("\\", "/");
  return (
    (/^src\/[^/]+\/(?:adapter|usecase)\/.+\.ts$/.test(normalized) || /^src\/entries\/.+\.ts$/.test(normalized)) &&
    !normalized.includes("/node_modules/")
  );
}

export function unwrap(node: ast.Expression): ast.Expression {
  let current = node;
  while (
    ast.isParenthesizedExpression(current) ||
    ast.isAsExpression(current) ||
    ast.isAssertionExpression(current) ||
    ast.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

export function propertyName(node: ast.Expression): string | undefined {
  if (ast.isIdentifier(node)) return node.text;
  if (ast.isPropertyAccessExpression(node)) return node.name.text;
  if (ast.isElementAccessExpression(node) && ast.isStringLiteral(node.argumentExpression))
    return node.argumentExpression.text;
  return undefined;
}

export function propertyReceiver(node: ast.Expression): ast.Expression | undefined {
  if (ast.isPropertyAccessExpression(node) || ast.isElementAccessExpression(node)) return node.expression;
  return undefined;
}

export function nodeKey(node: ast.Node): string {
  return `${node.getSourceFile().fileName}:${node.pos}:${node.end}:${node.kind}`;
}

export function moduleSpecifierOf(node: ast.Node): string | undefined {
  let current: ast.Node | undefined = node;
  while (current !== undefined) {
    if (ast.isImportDeclaration(current)) {
      return ast.isStringLiteral(current.moduleSpecifier) ? current.moduleSpecifier.text : undefined;
    }
    current = current.parent;
  }
  return undefined;
}

export function isModuleIn(source: string | undefined, modules: ReadonlySet<string>): boolean {
  if (source === undefined) return false;
  if (modules.has(source)) return true;
  return (
    (modules.has("kernel/infrastructure") && source.includes("/kernel/infrastructure/")) ||
    (modules.has("result-composition") && source.includes("result-composition"))
  );
}

export function variableInitializer(node: ast.Node): ast.Expression | undefined {
  if (ast.isVariableDeclaration(node)) return node.initializer;
  if (!ast.isBindingElement(node)) return undefined;
  let pattern: ast.Node = node.parent;
  while (ast.isObjectBindingPattern(pattern) || ast.isArrayBindingPattern(pattern)) pattern = pattern.parent;
  return ast.isVariableDeclaration(pattern) ? pattern.initializer : undefined;
}

export function containsNode(root: ast.Node, target: ast.Node): boolean {
  if (root === target || (root.getStart() === target.getStart() && root.getEnd() === target.getEnd())) return true;
  let found = false;
  root.forEachChild((child) => {
    if (!found && containsNode(child, target)) found = true;
  });
  return found;
}

export function walk(root: ast.Node): ast.Node[] {
  const nodes: ast.Node[] = [];
  const visit = (node: ast.Node): void => {
    nodes.push(node);
    node.forEachChild(visit);
  };
  visit(root);
  return nodes;
}

export function textOf(node: ast.Node): string {
  return node.getText(node.getSourceFile());
}

export function isIdentifierNamed(node: ast.Node | undefined, name: string): boolean {
  return node !== undefined && ast.isIdentifier(node) && node.text === name;
}
