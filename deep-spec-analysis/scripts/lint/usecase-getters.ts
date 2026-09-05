import { dirname, relative, resolve } from "node:path";
import * as ast from "typescript/unstable/ast";
import { API, type Checker, type Type } from "typescript/unstable/async";
import { belongsToDomain, DomainGetterClassifier } from "./domain-getter-classifier.ts";

export interface GetterDiagnostic {
  readonly rule:
    | "usecase-domain-getter"
    | "usecase-result-unwrapping"
    | "unclassified-domain-access"
    | "unclassified-usecase-call";
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly member: string;
  readonly declaration: string;
  readonly declarationLine: number;
}

export interface GetterLintReport {
  readonly checkedFiles: number;
  readonly diagnostics: readonly GetterDiagnostic[];
}

function isUsecaseSource(path: string, root: string): boolean {
  return (
    /^src\/[^/]+\/usecase\/.+\.ts$/.test(relative(root, path).replaceAll("\\", "/")) && !path.includes("node_modules")
  );
}

async function memberDeclaration(checker: Checker, node: ast.Node): Promise<ast.Node | undefined> {
  if (ast.isPropertyAccessExpression(node)) {
    const symbol = await checker.getSymbolAtLocation(node.name);
    return (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve();
  }
  if (ast.isCallExpression(node)) return (await checker.getResolvedSignature(node))?.declaration?.resolve();
  if (ast.isBindingElement(node) && ast.isObjectBindingPattern(node.parent)) {
    const name = node.propertyName ?? node.name;
    if (name === undefined || !(ast.isIdentifier(name) || ast.isStringLiteral(name))) return undefined;
    const type = await checker.getTypeAtLocation(node.parent);
    const symbol = type === undefined ? undefined : await checker.getPropertyOfType(type, name.text);
    return (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve();
  }
  return undefined;
}

async function literalKeys(type: Type | undefined): Promise<readonly string[]> {
  if (type?.isStringLiteralType()) return [type.value];
  if (type?.isUnionType()) return (await Promise.all((await type.getTypes()).map(literalKeys))).flat();
  return [];
}

async function memberDeclarations(checker: Checker, node: ast.Node): Promise<readonly (ast.Node | undefined)[]> {
  let key: ast.Expression | undefined;
  let receiver: ast.Node | undefined;
  if (ast.isElementAccessExpression(node)) {
    key = node.argumentExpression;
    receiver = node.expression;
  } else if (
    ast.isBindingElement(node) &&
    ast.isObjectBindingPattern(node.parent) &&
    node.propertyName !== undefined &&
    ast.isComputedPropertyName(node.propertyName)
  ) {
    key = node.propertyName.expression;
    receiver = node.parent;
  }
  if (key === undefined || receiver === undefined) return [await memberDeclaration(checker, node)];
  const owner = await checker.getTypeAtLocation(receiver);
  const keys = await literalKeys(await checker.getTypeAtLocation(key));
  if (owner === undefined) return [undefined];
  if (keys.length === 0) {
    const symbol = await owner.getSymbol();
    return [await (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve()];
  }
  return Promise.all(
    keys.map(async (name) => {
      const symbol = await checker.getPropertyOfType(owner, name);
      return (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve();
    }),
  );
}

function isResultValue(declaration: ast.Node): boolean {
  return (
    ast.isPropertySignatureDeclaration(declaration) &&
    declaration.name.getText() === "value" &&
    declaration.getSourceFile().fileName.replaceAll("\\", "/").endsWith("/src/kernel/infrastructure/result-success.ts")
  );
}

function memberName(declaration: ast.Node): string {
  if (
    ast.isMethodDeclaration(declaration) ||
    ast.isGetAccessorDeclaration(declaration) ||
    ast.isPropertyDeclaration(declaration) ||
    ast.isPropertySignatureDeclaration(declaration) ||
    ast.isMethodSignatureDeclaration(declaration)
  ) {
    const owner = declaration.parent;
    const name = ast.isClassDeclaration(owner) || ast.isInterfaceDeclaration(owner) ? owner.name?.text : undefined;
    return `${name === undefined ? "" : `${name}.`}${declaration.name.getText()}`;
  }
  return declaration.getText().split("\n")[0];
}

// TypeScriptの非同期Compiler APIを使用する。同期版はBunのpipe実装に対応していない。
// 解決エラーを握りつぶさず、型検査不能ならCLI自体を失敗させる。
export async function lintUsecaseGetters(configFile: string): Promise<GetterLintReport> {
  const config = resolve(configFile);
  const root = dirname(config);
  const api = new API({ cwd: root });
  try {
    const snapshot = await api.updateSnapshot({ openProjects: [config] });
    const project = snapshot.getProject(config);
    if (project === undefined) throw new Error(`TypeScript project could not be loaded: ${config}`);
    const configurationErrors = await project.program.getConfigFileParsingDiagnostics();
    if (configurationErrors.length > 0)
      throw new Error(`TypeScript configuration has ${configurationErrors.length} error(s)`);
    const errors = [
      ...(await project.program.getSyntacticDiagnostics()),
      ...(await project.program.getSemanticDiagnostics()),
    ];
    if (errors.length > 0) throw new Error(`TypeScript source has ${errors.length} error(s) in project ${config}`);
    const files = (await project.program.getSourceFileNames()).filter((path) => isUsecaseSource(path, root));
    if (files.length === 0) throw new Error(`No usecase source files found: ${config}`);
    const classifier = new DomainGetterClassifier(project.checker);
    const diagnostics: GetterDiagnostic[] = [];
    for (const file of files) {
      const source = await project.program.getSourceFile(file);
      if (source === undefined) throw new Error(`TypeScript source could not be loaded: ${file}`);
      const candidates: ast.Node[] = [];
      const visit = (node: ast.Node): void => {
        if (
          ast.isCallExpression(node) ||
          ast.isPropertyAccessExpression(node) ||
          ast.isElementAccessExpression(node) ||
          ast.isBindingElement(node)
        )
          candidates.push(node);
        node.forEachChild(visit);
      };
      visit(source);
      const accesses = (
        await Promise.all(
          candidates.map(async (node) =>
            (await memberDeclarations(project.checker, node)).map((resolved) => ({ node, resolved })),
          ),
        )
      ).flat();
      const emitted = new Set<string>();
      for (const { node, resolved } of accesses) {
        const opaqueCall =
          (resolved === undefined && !ast.isBindingElement(node)) ||
          (resolved !== undefined &&
            ast.isMethodSignatureDeclaration(resolved) &&
            !resolved.getSourceFile().isDeclarationFile &&
            !resolved.getSourceFile().fileName.replaceAll("\\", "/").includes("/usecase/port/") &&
            !belongsToDomain(resolved));
        if (resolved === undefined && !opaqueCall) continue;
        const declaration = resolved ?? node;
        let rule: GetterDiagnostic["rule"];
        if (opaqueCall) rule = "unclassified-usecase-call";
        else if (isResultValue(declaration)) rule = "usecase-result-unwrapping";
        else {
          if (!belongsToDomain(declaration)) continue;
          const classification = await classifier.classify(declaration);
          if (classification === "behavior") continue;
          rule = classification === "getter" ? "usecase-domain-getter" : "unclassified-domain-access";
        }
        // `model.irHash()`のcallとmember referenceは1件にまとめる。
        const key = `${node.getStart()}:${declaration.getSourceFile().fileName}:${declaration.pos}:${rule}`;
        if (emitted.has(key)) continue;
        emitted.add(key);
        const position = source.getLineAndCharacterOfPosition(node.getStart());
        const declarationPosition = declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart());
        diagnostics.push({
          rule,
          path: relative(root, file).replaceAll("\\", "/"),
          line: position.line + 1,
          column: position.character + 1,
          member: memberName(declaration),
          declaration: relative(root, declaration.getSourceFile().fileName).replaceAll("\\", "/"),
          declarationLine: declarationPosition.line + 1,
        });
      }
    }
    diagnostics.sort(
      (a, b) =>
        a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column || a.member.localeCompare(b.member),
    );
    return { checkedFiles: files.length, diagnostics };
  } finally {
    await api.close();
  }
}
