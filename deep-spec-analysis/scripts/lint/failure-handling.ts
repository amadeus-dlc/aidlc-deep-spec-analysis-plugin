import { realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as ast from "typescript/unstable/ast";
import { API, type Checker, type Type } from "typescript/unstable/async";

import {
  CHILD_PROCESS_MODULES,
  containsNode,
  ERROR_WORDS,
  FILESYSTEM_MODULES,
  FILESYSTEM_READ_APIS,
  isIdentifierNamed,
  isModuleIn,
  isTargetSource,
  KERNEL_INFRASTRUCTURE_MODULE,
  moduleSpecifierOf,
  nodeKey,
  OUTPUT_MATCH_APIS,
  PROCESS_APIS,
  propertyName,
  propertyReceiver,
  unwrap,
  variableInitializer,
  walk,
} from "./failure-handling-ast.ts";
import {
  callbackReturns,
  catchFallbackIsEnoentOnly,
  collapseExpression,
  conditionIsNegated,
  hasFallbackInCatch,
  isFallbackExpression,
  isSuccessKindObject,
  statementAlwaysExplicitFailure,
  stringLiteralValue,
} from "./failure-handling-flow.ts";

export type FailureHandlingRule =
  | "process-output-classification"
  | "filesystem-error-collapse"
  | "filesystem-existence-gate"
  | "repository-error-collapse";

export interface FailureHandlingDiagnostic {
  readonly rule: FailureHandlingRule;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export interface FailureHandlingLintReport {
  readonly checkedFiles: number;
  readonly diagnostics: readonly FailureHandlingDiagnostic[];
}

class SourceAnalysis {
  readonly #checker: Checker;
  readonly #source: ast.SourceFile;
  readonly #spawnResultCache = new Map<string, Promise<boolean>>();
  readonly #outputCache = new Map<string, Promise<boolean>>();
  readonly #literalCache = new Map<string, Promise<string | undefined>>();

  constructor(checker: Checker, source: ast.SourceFile) {
    this.#checker = checker;
    this.#source = source;
  }

  async #symbolDeclarations(node: ast.Node): Promise<readonly ast.Node[]> {
    const symbol = await this.#checker.getSymbolAtLocation(node);
    if (symbol === undefined) return [];
    const resolved = await Promise.all(symbol.declarations.map((declaration) => declaration.resolve()));
    return resolved.filter((declaration): declaration is ast.Node => declaration !== undefined);
  }

  async #hasModuleOrigin(node: ast.Expression, modules: ReadonlySet<string>, seen: Set<number>): Promise<boolean> {
    const current = unwrap(node);
    if (ast.isCallExpression(current)) {
      const callee = unwrap(current.expression);
      if (isIdentifierNamed(callee, "require") && current.arguments.length === 1) {
        const module = current.arguments[0];
        if (ast.isStringLiteral(module)) return modules.has(module.text);
      }
    }
    const identifier = ast.isIdentifier(current)
      ? current
      : ast.isPropertyAccessExpression(current) || ast.isElementAccessExpression(current)
        ? undefined
        : undefined;
    if (identifier !== undefined) {
      const symbol = await this.#checker.getSymbolAtLocation(identifier);
      if (symbol === undefined || seen.has(symbol.id)) return false;
      seen.add(symbol.id);
      for (const declaration of await this.#symbolDeclarations(identifier)) {
        const importedFrom = moduleSpecifierOf(declaration);
        if (isModuleIn(importedFrom, modules)) return true;
        const initializer = variableInitializer(declaration);
        if (initializer !== undefined && (await this.#hasModuleOrigin(initializer, modules, seen))) return true;
      }
      return false;
    }
    const receiver = propertyReceiver(current);
    return receiver === undefined ? false : this.#hasModuleOrigin(receiver, modules, seen);
  }

  async #importedApiNames(node: ast.Expression, seen: Set<number>): Promise<ReadonlySet<string>> {
    const current = unwrap(node);
    const names = new Set<string>();
    if (ast.isPropertyAccessExpression(current) || ast.isElementAccessExpression(current)) {
      const name = propertyName(current);
      if (name !== undefined) names.add(name);
      return names;
    }
    if (!ast.isIdentifier(current)) return names;
    const symbol = await this.#checker.getSymbolAtLocation(current);
    if (symbol === undefined || seen.has(symbol.id)) return names;
    seen.add(symbol.id);
    for (const declaration of await this.#symbolDeclarations(current)) {
      if (ast.isImportSpecifier(declaration)) {
        names.add(declaration.propertyName?.text ?? declaration.name.text);
      } else {
        const initializer = variableInitializer(declaration);
        if (initializer !== undefined) {
          for (const name of await this.#importedApiNames(initializer, seen)) names.add(name);
        }
      }
    }
    return names;
  }

  async isApiCall(
    node: ast.CallExpression,
    names: ReadonlySet<string>,
    modules: ReadonlySet<string>,
  ): Promise<boolean> {
    const name = propertyName(node.expression);
    if (name === undefined) return false;
    const callee = unwrap(node.expression);
    if (
      (ast.isPropertyAccessExpression(callee) || ast.isElementAccessExpression(callee)) &&
      isIdentifierNamed(callee.expression, "Bun")
    )
      return names.has(name);
    const base = propertyReceiver(callee) ?? callee;
    const origin = await this.#hasModuleOrigin(base, modules, new Set());
    if (!origin) return false;
    if (names.has(name)) return true;
    for (const importedName of await this.#importedApiNames(base, new Set())) {
      if (names.has(importedName)) return true;
    }
    return false;
  }

  async isProcessCall(node: ast.CallExpression): Promise<boolean> {
    return this.isApiCall(node, PROCESS_APIS, CHILD_PROCESS_MODULES);
  }

  async isFilesystemReadCall(node: ast.CallExpression): Promise<boolean> {
    return this.isApiCall(node, FILESYSTEM_READ_APIS, FILESYSTEM_MODULES);
  }

  async isExistsCall(node: ast.CallExpression): Promise<boolean> {
    return this.isApiCall(node, new Set(["existsSync"]), FILESYSTEM_MODULES);
  }

  async #resolveAliasExpression(node: ast.Expression, seen: Set<number> = new Set()): Promise<ast.Expression> {
    const current = unwrap(node);
    if (!ast.isIdentifier(current)) return current;
    const symbol = await this.#checker.getSymbolAtLocation(current);
    if (symbol === undefined || seen.has(symbol.id)) return current;
    seen.add(symbol.id);
    for (const declaration of await this.#symbolDeclarations(current)) {
      const initializer = variableInitializer(declaration);
      if (initializer !== undefined) return this.#resolveAliasExpression(initializer, seen);
    }
    return current;
  }

  async branchHasFallback(node: ast.Statement | undefined): Promise<boolean> {
    if (node === undefined) return false;
    for (const candidate of walk(node)) {
      if (ast.isContinueStatement(candidate) || ast.isBreakStatement(candidate)) return true;
      if (ast.isReturnStatement(candidate)) {
        if (candidate.expression === undefined) return true;
        if (isFallbackExpression(await this.#resolveAliasExpression(candidate.expression))) return true;
      }
    }
    return false;
  }

  async #isSpawnResultUncached(node: ast.Expression, seen: Set<number>): Promise<boolean> {
    const current = unwrap(node);
    if (ast.isCallExpression(current)) return this.isProcessCall(current);
    if (!ast.isIdentifier(current)) return false;
    const symbol = await this.#checker.getSymbolAtLocation(current);
    if (symbol === undefined || seen.has(symbol.id)) return false;
    seen.add(symbol.id);
    for (const declaration of await this.#symbolDeclarations(current)) {
      const initializer = variableInitializer(declaration);
      if (initializer !== undefined && (await this.#isSpawnResultUncached(initializer, seen))) return true;
    }
    return false;
  }

  async isSpawnResult(node: ast.Expression): Promise<boolean> {
    const key = nodeKey(node);
    const cached = this.#spawnResultCache.get(key);
    if (cached !== undefined) return cached;
    const result = this.#isSpawnResultUncached(node, new Set());
    this.#spawnResultCache.set(key, result);
    return result;
  }

  async #hasOutputShape(node: ast.Expression): Promise<boolean> {
    const type = await this.#checker.getTypeAtLocation(node);
    if (type === undefined) return false;
    if (type.isUnionType()) {
      const members = await type.getTypes();
      return (
        members !== undefined && (await Promise.all(members.map((member) => this.#hasOutputType(member)))).some(Boolean)
      );
    }
    return this.#hasOutputType(type);
  }

  async #hasOutputType(type: Type): Promise<boolean> {
    const stdout = await this.#checker.getPropertyOfType(type, "stdout");
    const stderr = await this.#checker.getPropertyOfType(type, "stderr");
    return stdout !== undefined && stderr !== undefined;
  }

  async #isOutputDerivedUncached(node: ast.Expression, seen: Set<number>): Promise<boolean> {
    const current = unwrap(node);
    if (ast.isPropertyAccessExpression(current) || ast.isElementAccessExpression(current)) {
      const name = propertyName(current);
      if (name === "stdout" || name === "stderr")
        return (await this.isSpawnResult(current.expression)) || (await this.#hasOutputShape(current.expression));
      return this.#isOutputDerivedUncached(current.expression, seen);
    }
    if (ast.isIdentifier(current)) {
      const symbol = await this.#checker.getSymbolAtLocation(current);
      if (symbol === undefined || seen.has(symbol.id)) return false;
      seen.add(symbol.id);
      for (const declaration of await this.#symbolDeclarations(current)) {
        if (ast.isBindingElement(declaration)) {
          const boundName = declaration.propertyName ?? declaration.name;
          const boundProperty =
            boundName !== undefined && ast.isIdentifier(boundName)
              ? boundName.text
              : boundName !== undefined && ast.isStringLiteral(boundName)
                ? boundName.text
                : undefined;
          const initializer = variableInitializer(declaration);
          if (
            initializer !== undefined &&
            (boundProperty === "stdout" || boundProperty === "stderr") &&
            (await this.isSpawnResult(initializer))
          )
            return true;
        }
        const initializer = variableInitializer(declaration);
        if (initializer !== undefined && (await this.#isOutputDerivedUncached(initializer, seen))) return true;
      }
      // Track a simple mutable local alias (`let out; out = run.stdout`) without
      // relying on text-only matching for imported names.
      for (const candidate of walk(this.#source)) {
        if (!ast.isBinaryExpression(candidate) || candidate.operatorToken.getText() !== "=") continue;
        if (!ast.isIdentifier(candidate.left) || candidate.left.text !== current.text) continue;
        if (await this.#isOutputDerivedUncached(candidate.right, seen)) return true;
      }
      return false;
    }
    if (ast.isCallExpression(current)) {
      const name = propertyName(current.expression);
      if (isIdentifierNamed(current.expression, "String")) {
        return (
          await Promise.all(
            current.arguments.map((argument) =>
              ast.isExpression(argument) ? this.#isOutputDerivedUncached(argument, seen) : Promise.resolve(false),
            ),
          )
        ).some(Boolean);
      }
      if (name === "parse" && propertyReceiver(current.expression) !== undefined) {
        const receiver = propertyReceiver(current.expression);
        if (isIdentifierNamed(receiver, "JSON")) return false;
      }
      if (name !== undefined && (await this.#isOutputDerivedUncached(current.expression, seen))) return true;
      return false;
    }
    if (ast.isNewExpression(current)) {
      if (current.arguments === undefined) return false;
      return (
        await Promise.all(
          current.arguments.map((argument) =>
            ast.isExpression(argument) ? this.#isOutputDerivedUncached(argument, seen) : Promise.resolve(false),
          ),
        )
      ).some(Boolean);
    }
    if (ast.isBinaryExpression(current)) {
      return (
        (ast.isExpression(current.left) && (await this.#isOutputDerivedUncached(current.left, seen))) ||
        (ast.isExpression(current.right) && (await this.#isOutputDerivedUncached(current.right, seen)))
      );
    }
    if (ast.isTemplateExpression(current)) {
      return (
        await Promise.all(current.templateSpans.map((span) => this.#isOutputDerivedUncached(span.expression, seen)))
      ).some(Boolean);
    }
    if (ast.isArrayLiteralExpression(current)) {
      return (
        await Promise.all(
          current.elements.map((element) =>
            ast.isExpression(element) ? this.#isOutputDerivedUncached(element, seen) : Promise.resolve(false),
          ),
        )
      ).some(Boolean);
    }
    if (ast.isObjectLiteralExpression(current)) {
      return (
        await Promise.all(
          current.properties.map((property) =>
            ast.isPropertyAssignment(property) && ast.isExpression(property.initializer)
              ? this.#isOutputDerivedUncached(property.initializer, seen)
              : Promise.resolve(false),
          ),
        )
      ).some(Boolean);
    }
    if (ast.isConditionalExpression(current)) {
      return (
        (await this.#isOutputDerivedUncached(current.whenTrue, seen)) ||
        (await this.#isOutputDerivedUncached(current.whenFalse, seen))
      );
    }
    return false;
  }

  async isOutputDerived(node: ast.Expression): Promise<boolean> {
    const key = nodeKey(node);
    const cached = this.#outputCache.get(key);
    if (cached !== undefined) return cached;
    const result = this.#isOutputDerivedUncached(node, new Set());
    this.#outputCache.set(key, result);
    return result;
  }

  async #literalUncached(node: ast.Expression, seen: Set<number>): Promise<string | undefined> {
    const current = unwrap(node);
    if (ast.isStringLiteral(current) || ast.isNoSubstitutionTemplateLiteral(current)) return current.text;
    if (ast.isTemplateExpression(current) && current.templateSpans.length === 0) return current.head.text;
    if (!ast.isIdentifier(current)) return undefined;
    const symbol = await this.#checker.getSymbolAtLocation(current);
    if (symbol === undefined || seen.has(symbol.id)) return undefined;
    seen.add(symbol.id);
    for (const declaration of await this.#symbolDeclarations(current)) {
      const initializer = variableInitializer(declaration);
      if (initializer !== undefined) {
        const value = await this.#literalUncached(initializer, seen);
        if (value !== undefined) return value;
      }
    }
    return undefined;
  }

  async literal(node: ast.Expression): Promise<string | undefined> {
    const key = nodeKey(node);
    const cached = this.#literalCache.get(key);
    if (cached !== undefined) return cached;
    const result = this.#literalUncached(node, new Set());
    this.#literalCache.set(key, result);
    return result;
  }

  async regexMatchesKeyword(node: ast.Expression): Promise<boolean> {
    const current = unwrap(node);
    if (ast.isRegularExpressionLiteral(current)) return ERROR_WORDS.test(current.getText(this.#source));
    if (ast.isNewExpression(current)) {
      const name = propertyName(current.expression);
      if ((name === undefined || name === "RegExp") && current.arguments?.[0] !== undefined) {
        const text = await this.literal(current.arguments[0]);
        return text !== undefined && ERROR_WORDS.test(text);
      }
    }
    if (ast.isIdentifier(current)) {
      const symbol = await this.#checker.getSymbolAtLocation(current);
      if (symbol !== undefined) {
        for (const declaration of await this.#symbolDeclarations(current)) {
          const initializer = variableInitializer(declaration);
          if (initializer !== undefined && (await this.regexMatchesKeyword(initializer))) return true;
        }
      }
    }
    return false;
  }

  async isOutputClassification(node: ast.CallExpression): Promise<boolean> {
    const callee = unwrap(node.expression);
    const name = propertyName(callee);
    if (name === undefined) return false;
    const receiver = propertyReceiver(callee);
    if (receiver === undefined) return false;
    if (OUTPUT_MATCH_APIS.has(name)) {
      const pattern = node.arguments[0];
      if (pattern === undefined) return false;
      const keyword = ast.isRegularExpressionLiteral(pattern)
        ? await this.regexMatchesKeyword(pattern)
        : (await this.literal(pattern)) !== undefined && ERROR_WORDS.test((await this.literal(pattern)) ?? "");
      return keyword && (await this.isOutputDerived(receiver));
    }
    if (name === "test" && (await this.regexMatchesKeyword(receiver))) {
      const value = node.arguments[0];
      return value !== undefined && ast.isExpression(value) && this.isOutputDerived(value);
    }
    return false;
  }

  async isMatchResultCall(node: ast.CallExpression): Promise<boolean> {
    return this.isApiCall(
      node,
      new Set(["matchResult"]),
      new Set([KERNEL_INFRASTRUCTURE_MODULE, "kernel/infrastructure", "result-composition"]),
    );
  }

  async resultLooksRepository(expr: ast.Expression, seen: Set<number> = new Set()): Promise<boolean> {
    const current = unwrap(expr);
    if (ast.isIdentifier(current)) {
      const symbol = await this.#checker.getSymbolAtLocation(current);
      if (symbol !== undefined && !seen.has(symbol.id)) {
        seen.add(symbol.id);
        for (const declaration of await this.#symbolDeclarations(current)) {
          const initializer = variableInitializer(declaration);
          if (initializer !== undefined && (await this.resultLooksRepository(initializer, seen))) return true;
          if (ast.isVariableDeclaration(declaration) && declaration.type !== undefined) {
            const declared = await this.#checker.getTypeFromTypeNode(declaration.type);
            if (declared !== undefined && (await this.#typeLooksRepository(declared))) return true;
          }
        }
      }
    }
    const type = await this.#checker.getTypeAtLocation(expr);
    if (type !== undefined) {
      const printed = await this.#checker.typeToString(type);
      if (printed.includes("RepositoryError")) return true;
      const alias = await type.getAliasSymbol();
      if (alias?.name === "Result") {
        const args = await type.getAliasTypeArguments();
        if (
          (await Promise.all(args.map((arg) => this.#checker.typeToString(arg)))).some((arg) =>
            arg.includes("RepositoryError"),
          )
        )
          return true;
      }
      if (type.isUnionType()) {
        const members = await type.getTypes();
        if (members && (await Promise.all(members.map((member) => this.#typeLooksRepository(member)))).some(Boolean)) {
          return true;
        }
      }
    }
    return false;
  }

  async #typeLooksRepository(type: Type): Promise<boolean> {
    const printed = await this.#checker.typeToString(type);
    if (printed.includes("RepositoryError")) return true;
    const alias = await type.getAliasSymbol();
    return alias?.name === "RepositoryError";
  }
}

function branchHasRead(node: ast.Statement | undefined, analysis: SourceAnalysis): Promise<boolean> {
  if (node === undefined) return Promise.resolve(false);
  return Promise.all(
    walk(node)
      .filter((candidate): candidate is ast.CallExpression => ast.isCallExpression(candidate))
      .map((candidate) => analysis.isFilesystemReadCall(candidate)),
  ).then((values) => values.some(Boolean));
}

async function existenceGate(call: ast.CallExpression, analysis: SourceAnalysis): Promise<boolean> {
  let current: ast.Node = call;
  while (current.parent !== undefined) {
    const parent = current.parent;
    if (ast.isIfStatement(parent) && containsNode(parent.expression, call)) {
      if ((await analysis.branchHasFallback(parent.thenStatement)) && conditionIsNegated(call, parent.expression))
        return true;
      if ((await analysis.branchHasFallback(parent.elseStatement)) && !conditionIsNegated(call, parent.expression))
        return true;
      if ((await branchHasRead(parent.thenStatement, analysis)) && parent.elseStatement === undefined) {
        const block = parent.parent;
        if (ast.isBlock(block)) {
          const index = block.statements.indexOf(parent);
          const next = index >= 0 ? block.statements[index + 1] : undefined;
          if (statementAlwaysExplicitFailure(next)) return false;
        }
        return true;
      }
      return false;
    }
    if (ast.isConditionalExpression(parent) && containsNode(parent.condition, call)) {
      return isFallbackExpression(conditionIsNegated(call, parent.condition) ? parent.whenTrue : parent.whenFalse);
    }
    if (ast.isCallExpression(parent) && ast.isPropertyAccessExpression(parent.expression)) {
      const method = parent.expression.name.text;
      if ((method === "filter" || method === "find") && containsNode(parent.arguments[0] ?? parent, call)) return true;
    }
    current = parent;
  }
  return false;
}

function propertyAssignment(node: ast.ObjectLiteralExpression, name: string): ast.Expression | undefined {
  for (const property of node.properties) {
    if (ast.isPropertyAssignment(property) && property.name.getText(node.getSourceFile()) === name)
      return property.initializer;
  }
  return undefined;
}

async function repositoryErrorCollapse(node: ast.CallExpression, analysis: SourceAnalysis): Promise<boolean> {
  const isMatch = await analysis.isMatchResultCall(node);
  if (!isMatch) return false;
  const source = node.arguments[0];
  const cases = node.arguments[1];
  if (source === undefined || cases === undefined || !ast.isExpression(source) || !ast.isObjectLiteralExpression(cases))
    return false;
  const isRepo = await analysis.resultLooksRepository(source);
  if (!isRepo) return false;
  const errCase = propertyAssignment(cases, "err");
  if (errCase === undefined || (!ast.isArrowFunction(errCase) && !ast.isFunctionExpression(errCase))) return false;
  const returns = callbackReturns(errCase);
  return returns.some(({ expression, guardedNotFound }) => !guardedNotFound && collapseExpression(expression));
}

interface ResultStatusExpression {
  readonly result: ast.Expression;
  readonly negated: boolean;
}

function resultStatusExpression(node: ast.Expression): ResultStatusExpression | undefined {
  const current = unwrap(node);
  if (ast.isPrefixUnaryExpression(current) && current.operator === ast.SyntaxKind.ExclamationToken) {
    const nested = resultStatusExpression(current.operand);
    return nested === undefined ? undefined : { result: nested.result, negated: !nested.negated };
  }
  if (propertyName(current) !== "ok") return undefined;
  const receiver = propertyReceiver(current);
  return receiver === undefined ? undefined : { result: receiver, negated: false };
}

function isSuccessResultExpression(node: ast.Expression): boolean {
  const current = unwrap(node);
  if (!ast.isObjectLiteralExpression(current)) return false;
  return current.properties.some(
    (property) =>
      ast.isPropertyAssignment(property) &&
      property.name.getText(current.getSourceFile()) === "ok" &&
      ast.isTrueLiteral(unwrap(property.initializer)),
  );
}

function sameSimpleExpression(left: ast.Expression, right: ast.Expression): boolean {
  const a = unwrap(left);
  const b = unwrap(right);
  return (
    (ast.isIdentifier(a) && ast.isIdentifier(b) && a.text === b.text) ||
    (ast.isPropertyAccessExpression(a) &&
      ast.isPropertyAccessExpression(b) &&
      a.name.text === b.name.text &&
      sameSimpleExpression(a.expression, b.expression))
  );
}

function referencesResultError(node: ast.Expression, result: ast.Expression): boolean {
  return walk(node).some(
    (candidate) =>
      ast.isPropertyAccessExpression(candidate) &&
      candidate.name.text === "error" &&
      sameSimpleExpression(candidate.expression, result),
  );
}

function forwardsRepositoryError(node: ast.Statement | undefined, result: ast.Expression): boolean {
  if (node === undefined) return false;
  if (ast.isReturnStatement(node)) {
    return node.expression !== undefined && referencesResultError(node.expression, result);
  }
  if (ast.isBlock(node)) {
    const statements = node.statements;
    return statements.length === 1 && forwardsRepositoryError(statements[0], result);
  }
  return false;
}

type ResultErrorKind = "enoent" | "not-enoent";

function resultKindCondition(node: ast.Expression, result: ast.Expression): ResultErrorKind | undefined {
  const current = unwrap(node);
  if (!ast.isBinaryExpression(current)) return undefined;
  const operator = current.operatorToken.getText();
  if (operator !== "===" && operator !== "==" && operator !== "!==" && operator !== "!=") return undefined;
  const left = stringLiteralValue(current.left);
  const right = stringLiteralValue(current.right);
  const field = left === "not-found" ? current.right : right === "not-found" ? current.left : undefined;
  if (
    field === undefined ||
    !ast.isPropertyAccessExpression(field) ||
    field.name.text !== "kind" ||
    !ast.isPropertyAccessExpression(field.expression) ||
    field.expression.name.text !== "error" ||
    !sameSimpleExpression(field.expression.expression, result)
  )
    return undefined;
  return operator === "===" || operator === "==" ? "enoent" : "not-enoent";
}

function notFoundGuardCondition(node: ast.Expression, result: ast.Expression): boolean {
  const current = unwrap(node);
  if (!ast.isBinaryExpression(current) || current.operatorToken.getText() !== "&&") return false;
  const status = [current.left, current.right].some((part) => {
    const parsed = resultStatusExpression(part);
    return parsed?.negated === true && sameSimpleExpression(parsed.result, result);
  });
  const nonNotFound = [current.left, current.right].some((part) => resultKindCondition(part, result) === "not-enoent");
  return status && nonNotFound;
}

function guardedByNotFoundBefore(node: ast.ConditionalExpression, result: ast.Expression): boolean {
  let current: ast.Node = node;
  while (current.parent !== undefined) {
    const parent = current.parent;
    if (ast.isReturnStatement(parent)) {
      const block = parent.parent;
      if (ast.isBlock(block)) {
        const index = block.statements.indexOf(parent);
        for (const statement of block.statements.slice(0, index)) {
          if (
            ast.isIfStatement(statement) &&
            notFoundGuardCondition(statement.expression, result) &&
            forwardsRepositoryError(statement.thenStatement, result)
          )
            return true;
        }
      }
      return false;
    }
    current = parent;
  }
  return false;
}

function manualCollapseExpression(node: ast.Expression): boolean {
  const current = unwrap(node);
  if (ast.isConditionalExpression(current))
    return manualCollapseExpression(current.whenTrue) && manualCollapseExpression(current.whenFalse);
  return isFallbackExpression(current) || isSuccessKindObject(current) || isSuccessResultExpression(current);
}

function returnGuardedByResultNotFound(node: ast.ReturnStatement, result: ast.Expression): boolean {
  let current: ast.Node = node;
  while (current.parent !== undefined) {
    const parent = current.parent;
    if (
      ast.isIfStatement(parent) &&
      containsNode(parent.thenStatement, node) &&
      resultKindCondition(parent.expression, result) === "enoent"
    )
      return true;
    current = parent;
  }
  return false;
}

function manualBranchCollapse(node: ast.Statement | undefined, result: ast.Expression): boolean {
  return (
    node !== undefined &&
    walk(node).some(
      (candidate) =>
        ast.isReturnStatement(candidate) &&
        candidate.expression !== undefined &&
        !returnGuardedByResultNotFound(candidate, result) &&
        manualCollapseExpression(candidate.expression),
    )
  );
}

async function manualRepositoryErrorCollapse(node: ast.IfStatement, analysis: SourceAnalysis): Promise<boolean> {
  const status = resultStatusExpression(node.expression);
  if (status === undefined) return false;
  const isRepository = await analysis.resultLooksRepository(status.result);
  if (!isRepository) return false;
  if (status.negated) return manualBranchCollapse(node.thenStatement, status.result);
  if (manualBranchCollapse(node.elseStatement, status.result)) return true;
  const block = node.parent;
  if (!ast.isBlock(block)) return false;
  const index = block.statements.indexOf(node);
  const next = index >= 0 ? block.statements[index + 1] : undefined;
  return manualBranchCollapse(next, status.result);
}

async function manualRepositoryConditionalCollapse(
  node: ast.ConditionalExpression,
  analysis: SourceAnalysis,
): Promise<boolean> {
  const status = resultStatusExpression(node.condition);
  if (status === undefined || !(await analysis.resultLooksRepository(status.result))) return false;
  const failureBranch = status.negated ? node.whenTrue : node.whenFalse;
  if (!status.negated && guardedByNotFoundBefore(node, status.result)) return false;
  return manualCollapseExpression(failureBranch);
}

async function analyzeSource(
  source: ast.SourceFile,
  checker: Checker,
  root: string,
): Promise<FailureHandlingDiagnostic[]> {
  const analysis = new SourceAnalysis(checker, source);
  const diagnostics: FailureHandlingDiagnostic[] = [];
  const emitted = new Set<string>();
  const add = (rule: FailureHandlingRule, node: ast.Node, message: string): void => {
    const key = `${rule}:${node.getStart()}`;
    if (emitted.has(key)) return;
    emitted.add(key);
    const position = source.getLineAndCharacterOfPosition(node.getStart());
    diagnostics.push({
      rule,
      path: relative(root, source.fileName).replaceAll("\\", "/"),
      line: position.line + 1,
      column: position.character + 1,
      message,
    });
  };

  for (const node of walk(source)) {
    if (ast.isIfStatement(node) && (await manualRepositoryErrorCollapse(node, analysis)))
      add(
        "repository-error-collapse",
        node,
        "a RepositoryError branch is unconditionally converted to not-applicable or success; preserve non-not-found failures",
      );
    if (ast.isConditionalExpression(node) && (await manualRepositoryConditionalCollapse(node, analysis)))
      add(
        "repository-error-collapse",
        node,
        "a RepositoryError branch is unconditionally converted to not-applicable or success; preserve non-not-found failures",
      );
    if (ast.isCallExpression(node)) {
      if (await analysis.isOutputClassification(node))
        add(
          "process-output-classification",
          node,
          "external process stdout/stderr is classified by an unanchored error/deadlock/fail/violation word; use exit/status/signal or a validated protocol",
        );
      if (await analysis.isExistsCall(node)) {
        const gate = await existenceGate(node, analysis);
        if (gate)
          add(
            "filesystem-existence-gate",
            node,
            "existsSync gates acquisition or silently excludes a missing artifact; return a typed RepositoryError or use an explicit unavailable result",
          );
      }
      if (await repositoryErrorCollapse(node, analysis))
        add(
          "repository-error-collapse",
          node,
          "a RepositoryError branch is unconditionally converted to not-applicable or success; preserve non-not-found failures",
        );
    }
    if (ast.isCatchClause(node) && hasFallbackInCatch(node) && !catchFallbackIsEnoentOnly(node)) {
      const tryBlock = ast.isTryStatement(node.parent) ? node.parent.tryBlock : undefined;
      const hasRead = (
        await Promise.all(
          walk(tryBlock ?? node.block)
            .filter((candidate): candidate is ast.CallExpression => ast.isCallExpression(candidate))
            .map((candidate) => analysis.isFilesystemReadCall(candidate)),
        )
      ).some(Boolean);
      if (hasRead)
        add(
          "filesystem-error-collapse",
          node,
          "filesystem acquisition errors are collapsed to null/empty/false/continue; distinguish ENOENT from other RepositoryErrors",
        );
    }
  }
  return diagnostics;
}

export async function lintFailureHandling(configFile: string): Promise<FailureHandlingLintReport> {
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
    if (files.length === 0) throw new Error(`No adapter/usecase/entry source files found: ${config}`);
    const diagnostics = (
      await Promise.all(
        files.map(async (file) => {
          const source = await project.program.getSourceFile(file);
          if (source === undefined) throw new Error(`TypeScript source could not be loaded: ${file}`);
          return analyzeSource(source, project.checker, root);
        }),
      )
    ).flat();
    diagnostics.sort(
      (a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule),
    );
    return { checkedFiles: files.length, diagnostics };
  } finally {
    await api.close();
  }
}
