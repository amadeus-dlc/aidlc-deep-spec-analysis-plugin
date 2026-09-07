import { realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as ast from "typescript/unstable/ast";
import { API, type Checker, SignatureKind, type Symbol as TsSymbol, type Type } from "typescript/unstable/async";

export interface ExplicitOverrideDiagnostic {
  readonly rule: "missing-override";
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly className: string;
  readonly member: string;
}

export interface ExplicitOverrideLintReport {
  readonly checkedFiles: number;
  readonly diagnostics: readonly ExplicitOverrideDiagnostic[];
}

type ClassLike = ast.ClassDeclaration | ast.ClassExpression;
type OverrideMember =
  | ast.MethodDeclaration
  | ast.PropertyDeclaration
  | ast.GetAccessorDeclaration
  | ast.SetAccessorDeclaration;
type OverrideCandidate = { readonly node: OverrideMember | ast.ParameterDeclaration; readonly name: ast.Node };

function isTargetSource(path: string, root: string): boolean {
  const normalized = relative(root, path).replaceAll("\\", "/");
  return /^(?:src|scripts|tests)\/.+\.ts$/.test(normalized) && !normalized.includes("/node_modules/");
}

function isOverrideMember(node: ast.Node): node is OverrideMember {
  return (
    ast.isMethodDeclaration(node) ||
    ast.isPropertyDeclaration(node) ||
    ast.isGetAccessorDeclaration(node) ||
    ast.isSetAccessorDeclaration(node)
  );
}

function hasOverrideModifier(node: OverrideMember): boolean {
  return node.modifiers?.some((modifier) => ast.isOverrideKeyword(modifier)) ?? false;
}

function hasDeclareModifier(node: OverrideMember): boolean {
  return node.modifiers?.some((modifier) => ast.isDeclareKeyword(modifier)) ?? false;
}

function isStaticMember(node: OverrideMember): boolean {
  return node.modifiers?.some((modifier) => ast.isStaticKeyword(modifier)) ?? false;
}

async function resolvedDeclarations(symbol: TsSymbol): Promise<readonly ast.Node[]> {
  const declarations = await Promise.all(symbol.declarations.map((declaration) => declaration.resolve()));
  return declarations.filter((declaration): declaration is ast.Node => declaration !== undefined);
}

async function declarationMatches(checker: Checker, symbol: TsSymbol, name: ast.Node): Promise<boolean> {
  if (ast.isPrivateIdentifier(name)) return false;
  const memberSymbol = await checker.getSymbolAtLocation(name);
  return memberSymbol !== undefined && memberSymbol.name === symbol.name;
}

async function instanceMembers(checker: Checker, bases: readonly Type[]): Promise<readonly TsSymbol[]> {
  const symbols: TsSymbol[] = [];
  for (const base of bases) symbols.push(...(await checker.getPropertiesOfType(base)));
  return symbols;
}

async function staticMembers(
  checker: Checker,
  bases: readonly Type[],
  seen: Set<number> = new Set(),
): Promise<readonly TsSymbol[]> {
  const symbols: TsSymbol[] = [];
  for (const base of bases) {
    if (seen.has(base.id)) continue;
    seen.add(base.id);
    const classSymbol = await base.getSymbol();
    if (classSymbol !== undefined) symbols.push(...Array.from(await classSymbol.getExports(), ([, symbol]) => symbol));
    let parents = await base.getBaseTypes();
    if (parents === undefined && classSymbol !== undefined) {
      for (const declaration of await resolvedDeclarations(classSymbol)) {
        if (ast.isClassDeclaration(declaration) || ast.isClassExpression(declaration)) {
          const declaredType = await checker.getTypeAtLocation(declaration);
          parents = declaredType === undefined ? undefined : await declaredType.getBaseTypes();
          if (parents !== undefined) break;
        }
      }
    }
    if (parents !== undefined) symbols.push(...(await staticMembers(checker, parents, seen)));
  }
  return symbols;
}

async function classMissingOverrides(checker: Checker, node: ClassLike): Promise<readonly OverrideCandidate[]> {
  let type = await checker.getTypeAtLocation(node);
  if (type !== undefined && ast.isClassExpression(node)) {
    const constructors = await checker.getSignaturesOfType(type, SignatureKind.Construct);
    const instance =
      constructors[0] === undefined ? undefined : await checker.getReturnTypeOfSignature(constructors[0]);
    if (instance !== undefined) type = instance;
  }
  if (type === undefined) {
    const position = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
    throw new Error(
      `TypeScript class type could not be resolved: ${node.getSourceFile().fileName}:${position.line + 1}:${position.character + 1} (${node.name?.text ?? "<anonymous>"})`,
    );
  }
  const bases = (await type.getBaseTypes()) ?? [];
  if (bases.length === 0) return [];
  const [instance, statics] = await Promise.all([instanceMembers(checker, bases), staticMembers(checker, bases)]);
  const missing: OverrideCandidate[] = [];
  for (const member of node.members) {
    if (ast.isConstructorDeclaration(member)) {
      for (const parameter of member.parameters) {
        const parameterProperty = parameter.modifiers?.some(
          (modifier) =>
            ast.isPublicKeyword(modifier) ||
            ast.isPrivateKeyword(modifier) ||
            ast.isProtectedKeyword(modifier) ||
            ast.isReadonlyKeyword(modifier),
        );
        if (!parameterProperty || !ast.isIdentifier(parameter.name)) continue;
        if (parameter.modifiers?.some((modifier) => ast.isOverrideKeyword(modifier))) continue;
        if (
          await Promise.all(instance.map((symbol) => declarationMatches(checker, symbol, parameter.name))).then(
            (values) => values.some(Boolean),
          )
        )
          missing.push({ node: parameter, name: parameter.name });
      }
      continue;
    }
    if (!isOverrideMember(member) || hasOverrideModifier(member) || hasDeclareModifier(member)) continue;
    const inherited = isStaticMember(member) ? statics : instance;
    if (
      await Promise.all(inherited.map((symbol) => declarationMatches(checker, symbol, member.name))).then((values) =>
        values.some(Boolean),
      )
    )
      missing.push({ node: member, name: member.name });
  }
  return missing;
}

export async function lintExplicitOverrides(configFile: string): Promise<ExplicitOverrideLintReport> {
  const config = realpathSync(resolve(configFile));
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
    const files = (await project.program.getSourceFileNames()).filter((path) => isTargetSource(path, root));
    if (files.length === 0) throw new Error(`No src/scripts/tests TypeScript files found: ${config}`);
    const diagnostics: ExplicitOverrideDiagnostic[] = [];
    for (const file of files) {
      const source = await project.program.getSourceFile(file);
      if (source === undefined) throw new Error(`TypeScript source could not be loaded: ${file}`);
      for (const node of sourceNodes(source)) {
        const missing = await classMissingOverrides(project.checker, node);
        for (const candidate of missing) {
          const position = source.getLineAndCharacterOfPosition(candidate.name.getStart());
          diagnostics.push({
            rule: "missing-override",
            path: relative(root, file).replaceAll("\\", "/"),
            line: position.line + 1,
            column: position.character + 1,
            className: node.name?.text ?? "<anonymous>",
            member: candidate.name.getText(source),
          });
        }
      }
    }
    diagnostics.sort(
      (a, b) =>
        a.path.localeCompare(b.path) ||
        a.line - b.line ||
        a.column - b.column ||
        a.className.localeCompare(b.className),
    );
    return { checkedFiles: files.length, diagnostics };
  } finally {
    await api.close();
  }
}

function sourceNodes(source: ast.SourceFile): ClassLike[] {
  const classes: ClassLike[] = [];
  const visit = (node: ast.Node): void => {
    if (ast.isClassDeclaration(node) || ast.isClassExpression(node)) classes.push(node);
    node.forEachChild(visit);
  };
  visit(source);
  return classes;
}
