import * as ast from "typescript/unstable/ast";
import { containsNode, propertyName, unwrap, walk } from "./failure-handling-ast.ts";

export function stringLiteralValue(node: ast.Expression): string | undefined {
  const current = unwrap(node);
  return ast.isStringLiteral(current) ? current.text : undefined;
}

export function isFallbackExpression(node: ast.Expression): boolean {
  const current = unwrap(node);
  if (
    ast.isNullLiteral(current) ||
    ast.isFalseLiteral(current) ||
    (ast.isArrayLiteralExpression(current) && current.elements.length === 0) ||
    (ast.isIdentifier(current) && (current.text === "undefined" || current.text === "null"))
  )
    return true;
  if (ast.isObjectLiteralExpression(current)) {
    return current.properties.some((property) => {
      if (!ast.isPropertyAssignment(property) || property.name.getText(current.getSourceFile()) !== "kind")
        return false;
      const value = stringLiteralValue(property.initializer);
      return value !== undefined && ["absent", "not-found", "not-applicable"].includes(value);
    });
  }
  if (ast.isCallExpression(current)) {
    const callee =
      propertyName(current.expression) ?? (ast.isIdentifier(current.expression) ? current.expression.text : "");
    if (
      callee === "ok" ||
      callee === "err" ||
      callee.endsWith("Err") ||
      callee === "notFound" ||
      callee === "notApplicable"
    ) {
      const first = current.arguments[0];
      return first === undefined || !ast.isExpression(first) || isFallbackExpression(first);
    }
  }
  return false;
}

export function isSuccessKindObject(node: ast.Expression): boolean {
  const current = unwrap(node);
  if (!ast.isObjectLiteralExpression(current)) return false;
  return current.properties.some((property) => {
    if (!ast.isPropertyAssignment(property) || property.name.getText(current.getSourceFile()) !== "kind") return false;
    const value = stringLiteralValue(property.initializer);
    return (
      value !== undefined && ["not-applicable", "verdict", "verified", "success", "clean", "checked"].includes(value)
    );
  });
}

type ErrorCodeCondition = "enoent" | "not-enoent";

export interface ErrorCodeContext {
  readonly catchName: string | undefined;
  readonly codeAliases: ReadonlySet<string>;
}

function containsCaughtCode(node: ast.Expression, catchName: string | undefined): boolean {
  if (catchName === undefined) return false;
  return walk(node).some(
    (candidate) =>
      ast.isPropertyAccessExpression(candidate) &&
      candidate.name.text === "code" &&
      ast.isIdentifier(candidate.expression) &&
      candidate.expression.text === catchName,
  );
}

function isCaughtCodeField(node: ast.Expression, context: ErrorCodeContext | undefined): boolean {
  if (context === undefined) return false;
  if (ast.isIdentifier(node)) return context.codeAliases.has(node.text);
  return (
    ast.isPropertyAccessExpression(node) &&
    node.name.text === "code" &&
    ast.isIdentifier(node.expression) &&
    node.expression.text === context.catchName
  );
}

export function errorCodeCondition(node: ast.Expression, context?: ErrorCodeContext): ErrorCodeCondition | undefined {
  const current = unwrap(node);
  if (ast.isPrefixUnaryExpression(current) && current.operator === ast.SyntaxKind.ExclamationToken) {
    const operand = errorCodeCondition(current.operand, context);
    return operand === "enoent" ? "not-enoent" : operand === "not-enoent" ? "enoent" : undefined;
  }
  if (!ast.isBinaryExpression(current)) return undefined;
  const operator = current.operatorToken.getText();
  if (operator !== "===" && operator !== "==" && operator !== "!==" && operator !== "!=") return undefined;
  const left = stringLiteralValue(current.left);
  const right = stringLiteralValue(current.right);
  const field = left === "ENOENT" ? current.right : right === "ENOENT" ? current.left : undefined;
  if (field === undefined || !isCaughtCodeField(field, context)) return undefined;
  return operator === "===" || operator === "==" ? "enoent" : "not-enoent";
}

export function conditionImplies(
  node: ast.Expression,
  wanted: ErrorCodeCondition,
  context?: ErrorCodeContext,
): boolean {
  const direct = errorCodeCondition(node, context);
  if (direct !== undefined) return direct === wanted;
  const current = unwrap(node);
  if (!ast.isBinaryExpression(current)) return false;
  const operator = current.operatorToken.getText();
  if (operator !== "&&" && operator !== "||") return false;
  const left = conditionImplies(current.left, wanted, context);
  const right = conditionImplies(current.right, wanted, context);
  return operator === "&&" ? left || right : left && right;
}

export function statementAlwaysThrows(node: ast.Statement | undefined): boolean {
  if (node === undefined) return false;
  if (ast.isThrowStatement(node)) return true;
  if (!ast.isBlock(node)) return false;
  const statements = node.statements;
  return statements.length > 0 && statements.some((statement) => statementAlwaysThrows(statement));
}

export function aliasesInBlock(node: ast.Node): Map<string, ast.Expression> {
  const aliases = new Map<string, ast.Expression>();
  for (const candidate of walk(node)) {
    if (ast.isVariableDeclaration(candidate) && ast.isIdentifier(candidate.name) && candidate.initializer !== undefined)
      aliases.set(candidate.name.text, candidate.initializer);
    if (
      ast.isBinaryExpression(candidate) &&
      candidate.operatorToken.getText() === "=" &&
      ast.isIdentifier(candidate.left) &&
      ast.isExpression(candidate.right)
    )
      aliases.set(candidate.left.text, candidate.right);
  }
  return aliases;
}

export function hasFallbackInCatch(node: ast.CatchClause): boolean {
  const aliases = aliasesInBlock(node.block);
  for (const candidate of walk(node.block)) {
    if (ast.isContinueStatement(candidate) || ast.isBreakStatement(candidate)) return true;
    if (ast.isReturnStatement(candidate)) {
      if (
        candidate.expression === undefined ||
        isFallbackExpression(resolveCallbackAlias(candidate.expression, aliases))
      )
        return true;
    }
    if (ast.isBinaryExpression(candidate) && candidate.operatorToken.getText() === "=") {
      if (ast.isExpression(candidate.right) && isFallbackExpression(resolveCallbackAlias(candidate.right, aliases)))
        return true;
    }
  }
  return false;
}

export function catchFallbackIsEnoentOnly(node: ast.CatchClause): boolean {
  const aliases = aliasesInBlock(node.block);
  const catchName =
    node.variableDeclaration !== undefined && ast.isIdentifier(node.variableDeclaration.name)
      ? node.variableDeclaration.name.text
      : undefined;
  const codeAliases = new Set<string>();
  for (const [name, expression] of aliases) {
    if (containsCaughtCode(expression, catchName)) codeAliases.add(name);
  }
  const context = { catchName, codeAliases };
  const statements = node.block.statements;
  for (let index = 0; index < statements.length; index++) {
    const statement = statements[index];
    if (statement === undefined || !ast.isIfStatement(statement)) continue;
    if (statements.slice(0, index).some((item) => branchHasFallback(item, aliases))) continue;
    const rest = statements.slice(index + 1);
    const restThrows = rest.length > 0 && rest.every((item) => statementAlwaysThrows(item));
    const thenFallback = branchHasFallback(statement.thenStatement, aliases);
    const elseFallback = branchHasFallback(statement.elseStatement, aliases);
    if (
      thenFallback &&
      conditionImplies(statement.expression, "enoent", context) &&
      (statement.elseStatement === undefined || statementAlwaysThrows(statement.elseStatement)) &&
      restThrows
    )
      return true;
    if (
      elseFallback &&
      conditionImplies(statement.expression, "not-enoent", context) &&
      statementAlwaysThrows(statement.thenStatement) &&
      restThrows
    )
      return true;
    if (
      statementAlwaysThrows(statement.thenStatement) &&
      conditionImplies(statement.expression, "not-enoent", context) &&
      !statement.elseStatement &&
      rest.some((item) => branchHasFallback(item))
    )
      return true;
  }
  return false;
}

export function conditionIsNegated(call: ast.CallExpression, condition: ast.Expression): boolean {
  let current: ast.Node = call;
  let negated = false;
  while (current !== condition && current.parent !== undefined) {
    const parent = current.parent;
    if (ast.isPrefixUnaryExpression(parent) && parent.operator === ast.SyntaxKind.ExclamationToken) negated = !negated;
    current = parent;
  }
  return negated;
}

export function branchHasFallback(
  node: ast.Statement | undefined,
  aliases: ReadonlyMap<string, ast.Expression> = new Map(),
): boolean {
  return (
    node !== undefined &&
    walk(node).some((candidate) => {
      if (ast.isContinueStatement(candidate) || ast.isBreakStatement(candidate)) return true;
      if (!ast.isReturnStatement(candidate)) return false;
      return (
        candidate.expression === undefined || isFallbackExpression(resolveCallbackAlias(candidate.expression, aliases))
      );
    })
  );
}

export function isExplicitFailureExpression(node: ast.Expression): boolean {
  const current = unwrap(node);
  if (ast.isObjectLiteralExpression(current)) {
    return current.properties.some((property) => {
      if (!ast.isPropertyAssignment(property) || property.name.getText(current.getSourceFile()) !== "kind")
        return false;
      const value = stringLiteralValue(property.initializer);
      return (
        value !== undefined &&
        [
          "unavailable",
          "backend-unavailable",
          "solver-unavailable",
          "io-failed",
          "corrupt",
          "acquisition-failed",
          "save-failed",
        ].includes(value)
      );
    });
  }
  if (ast.isCallExpression(current)) {
    const callee = propertyName(current.expression) ?? "";
    if (callee === "err" || callee.endsWith("Err")) {
      const first = current.arguments[0];
      return first !== undefined && ast.isExpression(first) && isExplicitFailureExpression(first);
    }
  }
  return false;
}

export function statementAlwaysExplicitFailure(node: ast.Statement | undefined): boolean {
  if (node === undefined) return false;
  if (ast.isReturnStatement(node)) return node.expression !== undefined && isExplicitFailureExpression(node.expression);
  if (ast.isBlock(node)) {
    const statements = node.statements;
    return statements.length > 0 && statements.every((statement) => statementAlwaysExplicitFailure(statement));
  }
  if (ast.isIfStatement(node))
    return statementAlwaysExplicitFailure(node.thenStatement) && statementAlwaysExplicitFailure(node.elseStatement);
  return false;
}

export type ErrorKindCondition = "not-found" | "not-not-found";

export function errorKindCondition(node: ast.Expression): ErrorKindCondition | undefined {
  const current = unwrap(node);
  if (ast.isPrefixUnaryExpression(current) && current.operator === ast.SyntaxKind.ExclamationToken) {
    const operand = errorKindCondition(current.operand);
    return operand === "not-found" ? "not-not-found" : operand === "not-not-found" ? "not-found" : undefined;
  }
  if (!ast.isBinaryExpression(current)) return undefined;
  const operator = current.operatorToken.getText();
  if (operator !== "===" && operator !== "==" && operator !== "!==" && operator !== "!=") return undefined;
  const left = stringLiteralValue(current.left);
  const right = stringLiteralValue(current.right);
  const field = left === "not-found" ? current.right : right === "not-found" ? current.left : undefined;
  if (field === undefined || propertyName(field) !== "kind") return undefined;
  return operator === "===" || operator === "==" ? "not-found" : "not-not-found";
}

export function conditionImpliesKind(node: ast.Expression, wanted: ErrorKindCondition): boolean {
  const direct = errorKindCondition(node);
  if (direct !== undefined) return direct === wanted;
  const current = unwrap(node);
  if (!ast.isBinaryExpression(current)) return false;
  const operator = current.operatorToken.getText();
  if (operator !== "&&" && operator !== "||") return false;
  const left = conditionImpliesKind(current.left, wanted);
  const right = conditionImpliesKind(current.right, wanted);
  return operator === "&&" ? left || right : left && right;
}

export interface CallbackReturn {
  readonly expression: ast.Expression;
  readonly guardedNotFound: boolean;
}

export function isNestedFunction(node: ast.Node, root: ast.ArrowFunction | ast.FunctionExpression): boolean {
  let current = node.parent;
  while (current !== undefined && current !== root) {
    if (ast.isFunctionDeclaration(current) || ast.isFunctionExpression(current) || ast.isArrowFunction(current))
      return true;
    current = current.parent;
  }
  return false;
}

export function resolveCallbackAlias(
  expression: ast.Expression,
  aliases: ReadonlyMap<string, ast.Expression>,
  seen: ReadonlySet<string> = new Set(),
): ast.Expression {
  const current = unwrap(expression);
  if (!ast.isIdentifier(current) || !aliases.has(current.text) || seen.has(current.text)) return current;
  const next = aliases.get(current.text);
  if (next === undefined) return current;
  return resolveCallbackAlias(next, aliases, new Set([...seen, current.text]));
}

export function returnGuardedByNotFound(
  node: ast.ReturnStatement,
  callback: ast.ArrowFunction | ast.FunctionExpression,
): boolean {
  let current: ast.Node = node;
  while (current.parent !== undefined && current.parent !== callback) {
    const parent = current.parent;
    if (ast.isIfStatement(parent)) {
      if (containsNode(parent.thenStatement, node) && conditionImpliesKind(parent.expression, "not-found")) return true;
      if (parent.elseStatement !== undefined && containsNode(parent.elseStatement, node)) {
        if (conditionImpliesKind(parent.expression, "not-not-found")) return true;
      }
    }
    current = parent;
  }
  return false;
}

export function callbackReturns(node: ast.ArrowFunction | ast.FunctionExpression): readonly CallbackReturn[] {
  if (!ast.isBlock(node.body)) return [{ expression: node.body, guardedNotFound: false }];
  const aliases = new Map<string, ast.Expression>();
  for (const candidate of walk(node.body)) {
    if (isNestedFunction(candidate, node)) continue;
    if (ast.isVariableDeclaration(candidate) && ast.isIdentifier(candidate.name) && candidate.initializer !== undefined)
      aliases.set(candidate.name.text, candidate.initializer);
    if (
      ast.isBinaryExpression(candidate) &&
      candidate.operatorToken.getText() === "=" &&
      ast.isIdentifier(candidate.left) &&
      ast.isExpression(candidate.right)
    )
      aliases.set(candidate.left.text, candidate.right);
  }
  return walk(node.body).flatMap((candidate) => {
    if (!ast.isReturnStatement(candidate) || isNestedFunction(candidate, node) || candidate.expression === undefined)
      return [];
    return [
      {
        expression: resolveCallbackAlias(candidate.expression, aliases),
        guardedNotFound: returnGuardedByNotFound(candidate, node),
      },
    ];
  });
}

export function collapseExpression(
  expression: ast.Expression,
  aliases: ReadonlyMap<string, ast.Expression> = new Map(),
): boolean {
  const current = resolveCallbackAlias(expression, aliases);
  if (ast.isConditionalExpression(current))
    return collapseExpression(current.whenTrue, aliases) && collapseExpression(current.whenFalse, aliases);
  return isFallbackExpression(current) || isSuccessKindObject(current);
}
