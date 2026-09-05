import * as ast from "typescript/unstable/ast";
import type { Checker, Symbol as CompilerSymbol } from "typescript/unstable/async";

export type AccessKind = "getter" | "behavior" | "unclassified";
type ReturnedKind = AccessKind | "constant";

export function belongsToDomain(node: ast.Node): boolean {
  return /\/src\/[^/]+\/domain\//.test(node.getSourceFile().fileName.replaceAll("\\", "/"));
}

function declarationKey(node: ast.Node): string {
  return `${node.getSourceFile().fileName}:${node.pos}`;
}

async function declarationOf(symbol: CompilerSymbol | undefined): Promise<ast.Node | undefined> {
  return (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve();
}

// 呼び先の本体をたどる。名前・引数の数・返値がVOかどうかではgetterを決めない。
// 比較/predicateや新たなドメイン値を作る処理と、保持値の取得/コピー/表現変換を区別する。
export class DomainGetterClassifier {
  readonly #checker: Checker;
  readonly #completed = new Map<string, AccessKind>();

  constructor(checker: Checker) {
    this.#checker = checker;
  }

  async classify(
    node: ast.Node,
    visiting = new Set<string>(),
    bindings: ReadonlyMap<string, ReturnedKind> = new Map(),
  ): Promise<AccessKind> {
    if (
      ast.isPropertyDeclaration(node) &&
      node.initializer !== undefined &&
      (ast.isArrowFunction(node.initializer) || ast.isFunctionExpression(node.initializer))
    ) {
      return this.classify(node.initializer, visiting, bindings);
    }
    if (
      ast.isGetAccessorDeclaration(node) ||
      ast.isPropertyDeclaration(node) ||
      ast.isPropertySignatureDeclaration(node)
    ) {
      return "getter";
    }
    const key = declarationKey(node);
    const cached = bindings.size === 0 ? this.#completed.get(key) : undefined;
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return "unclassified";
    if (
      !(
        ast.isMethodDeclaration(node) ||
        ast.isFunctionDeclaration(node) ||
        ast.isArrowFunction(node) ||
        ast.isFunctionExpression(node)
      ) ||
      node.body === undefined
    ) {
      return "unclassified";
    }
    const path = new Set(visiting).add(key);
    const returned: ast.Expression[] = [];
    const visit = (child: ast.Node): void => {
      if (child !== node.body && ast.isFunctionLikeDeclaration(child)) return;
      if (ast.isReturnStatement(child) && child.expression !== undefined) returned.push(child.expression);
      if (ast.isYieldExpression(child) && child.expression !== undefined) returned.push(child.expression);
      child.forEachChild(visit);
    };
    if (ast.isBlock(node.body)) visit(node.body);
    else returned.push(node.body);
    const kinds = await Promise.all(returned.map((expression) => this.#expression(expression, path, bindings)));
    const result =
      kinds.includes("unclassified") || (kinds.includes("getter") && kinds.includes("behavior"))
        ? "unclassified"
        : kinds.includes("getter") && !kinds.includes("behavior")
          ? "getter"
          : "behavior";
    if (bindings.size === 0) this.#completed.set(key, result);
    return result;
  }

  async #expression(
    node: ast.Expression,
    path: Set<string>,
    bindings: ReadonlyMap<string, ReturnedKind>,
  ): Promise<ReturnedKind> {
    if (ast.isArrowFunction(node) || ast.isFunctionExpression(node)) return this.classify(node, path, bindings);
    if (
      ast.isParenthesizedExpression(node) ||
      ast.isAsExpression(node) ||
      ast.isNonNullExpression(node) ||
      ast.isSatisfiesExpression(node)
    ) {
      return this.#expression(node.expression, path, bindings);
    }
    if (ast.isIdentifier(node)) {
      const symbol = ast.isShorthandPropertyAssignment(node.parent)
        ? await this.#checker.getShorthandAssignmentValueSymbol(node.parent)
        : await this.#checker.getSymbolAtLocation(node);
      const declaration = await declarationOf(symbol);
      if (declaration !== undefined) {
        const supplied = bindings.get(declarationKey(declaration));
        if (supplied !== undefined) return supplied;
      }
      if (declaration?.getSourceFile().isDeclarationFile) return "constant";
      if (
        declaration !== undefined &&
        ast.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined
      ) {
        if (!ast.isVariableDeclarationList(declaration.parent) || !(declaration.parent.flags & ast.NodeFlags.Const))
          return this.#domainAccumulator(declaration, path, bindings);
        if (
          ast.isArrayLiteralExpression(declaration.initializer) ||
          ast.isObjectLiteralExpression(declaration.initializer)
        )
          return "unclassified";
        const key = declarationKey(declaration);
        if (path.has(key)) return "unclassified";
        return this.#expression(declaration.initializer, new Set(path).add(key), bindings);
      }
      if (node.text === "undefined") return "constant";
      if (declaration !== undefined && ast.isParameterDeclaration(declaration) && (await this.#isDomainValue(node)))
        return "behavior";
      if (
        declaration !== undefined &&
        (ast.isParameterDeclaration(declaration) ||
          ast.isBindingElement(declaration) ||
          ast.isVariableDeclaration(declaration))
      )
        return "unclassified";
      return "behavior";
    }
    if (ast.isPropertyAccessExpression(node) || ast.isElementAccessExpression(node)) {
      if (node.expression.kind === ast.SyntaxKind.ThisKeyword) {
        const target = ast.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;
        const declaration = await declarationOf(await this.#checker.getSymbolAtLocation(target));
        return declaration !== undefined && ast.isGetAccessorDeclaration(declaration)
          ? this.classify(declaration, path, bindings)
          : "getter";
      }
      return this.#expression(node.expression, path, bindings);
    }
    if (ast.isCallExpression(node) || ast.isNewExpression(node)) {
      if (ast.isNewExpression(node)) {
        const constructedType = await this.#checker.getTypeAtLocation(node);
        const constructed = await declarationOf(await constructedType?.getSymbol());
        if (constructed !== undefined && ast.isClassDeclaration(constructed) && belongsToDomain(constructed))
          return "behavior";
      }
      const signature = await this.#checker.getResolvedSignature(node);
      const declaration = await signature?.declaration?.resolve();
      // 引数のcallbackへのdispatchは操作の委譲。本体のないドメインinterfaceとは区別する。
      if (
        declaration !== undefined &&
        (ast.isFunctionTypeNode(declaration) || ast.isMethodSignatureDeclaration(declaration))
      ) {
        let owner: ast.Node | undefined = declaration.parent;
        while (owner !== undefined && !ast.isSourceFile(owner)) {
          if (ast.isParameterDeclaration(owner)) return "behavior";
          owner = owner.parent;
        }
      }
      if (declaration !== undefined && belongsToDomain(declaration)) {
        // コンストラクタ/ファクトリによる新しいドメイン値の生成は不変変換。
        if (ast.isConstructorDeclaration(declaration)) return "behavior";
        return this.#called(declaration, node.arguments ?? [], path, bindings);
      }
      // ユーザー定義のヘルパーを通じた取得も見落とさない。
      if (declaration !== undefined && !declaration.getSourceFile().isDeclarationFile) {
        return this.#called(declaration, node.arguments ?? [], path, bindings);
      }
      if (signature === undefined || declaration === undefined) return "unclassified";
      const resultType = await this.#checker.getReturnTypeOfSignature(signature);
      // 組込みのtest/includes等に判断を依頼するpredicateは単なる表現取得ではない。
      const booleanCoercion =
        ast.isInterfaceDeclaration(declaration.parent) && declaration.parent.name.text === "BooleanConstructor";
      if (!booleanCoercion && resultType !== undefined && (await this.#checker.typeToString(resultType)) === "boolean")
        return "behavior";
      const inputs: ast.Expression[] = [...(node.arguments ?? [])];
      if (ast.isPropertyAccessExpression(node.expression) || ast.isElementAccessExpression(node.expression)) {
        inputs.push(node.expression.expression);
      }
      return this.#derived(inputs, path, bindings);
    }
    if (ast.isBinaryExpression(node)) {
      const comparisons = [
        ast.SyntaxKind.EqualsEqualsToken,
        ast.SyntaxKind.EqualsEqualsEqualsToken,
        ast.SyntaxKind.ExclamationEqualsToken,
        ast.SyntaxKind.ExclamationEqualsEqualsToken,
        ast.SyntaxKind.GreaterThanToken,
        ast.SyntaxKind.GreaterThanEqualsToken,
        ast.SyntaxKind.LessThanToken,
        ast.SyntaxKind.LessThanEqualsToken,
        ast.SyntaxKind.InstanceOfKeyword,
        ast.SyntaxKind.InKeyword,
      ];
      if (comparisons.includes(node.operatorToken.kind)) return "behavior";
      if (
        node.operatorToken.kind === ast.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ast.SyntaxKind.BarBarToken
      ) {
        const operands = await Promise.all([
          this.#expression(node.left, path, bindings),
          this.#expression(node.right, path, bindings),
        ]);
        if (operands.includes("behavior")) return "behavior";
      }
      return this.#derived([node.left, node.right], path, bindings);
    }
    if (ast.isConditionalExpression(node)) return this.#derived([node.whenTrue, node.whenFalse], path, bindings);
    if (ast.isPrefixUnaryExpression(node)) {
      return node.operator === ast.SyntaxKind.ExclamationToken
        ? "behavior"
        : this.#expression(node.operand, path, bindings);
    }
    if (ast.isArrayLiteralExpression(node)) return this.#derived(node.elements, path, bindings);
    if (ast.isSpreadElement(node)) return this.#expression(node.expression, path, bindings);
    if (ast.isObjectLiteralExpression(node)) {
      const values: ast.Expression[] = [];
      for (const property of node.properties) {
        if (ast.isPropertyAssignment(property)) values.push(property.initializer);
        else if (ast.isShorthandPropertyAssignment(property) && ast.isIdentifier(property.name))
          values.push(property.name);
        else if (ast.isSpreadAssignment(property)) values.push(property.expression);
        else return "unclassified";
      }
      return this.#derived(values, path, bindings);
    }
    if (ast.isTemplateExpression(node))
      return this.#derived(
        node.templateSpans.map((span) => span.expression),
        path,
        bindings,
      );
    if (ast.isAwaitExpression(node)) return this.#expression(node.expression, path, bindings);
    if (
      ast.isLiteralExpression(node) ||
      node.kind === ast.SyntaxKind.NullKeyword ||
      node.kind === ast.SyntaxKind.TrueKeyword ||
      node.kind === ast.SyntaxKind.FalseKeyword ||
      node.kind === ast.SyntaxKind.ThisKeyword
    )
      return node.kind === ast.SyntaxKind.ThisKeyword ? "behavior" : "constant";
    return "unclassified";
  }

  async #isDomainValue(node: ast.Node): Promise<boolean> {
    const type = await this.#checker.getTypeAtLocation(node);
    const declaration = await declarationOf(await type?.getSymbol());
    return declaration !== undefined && ast.isClassDeclaration(declaration) && belongsToDomain(declaration);
  }

  // helperの引数由来を保つ。identity(privateField)をドメイン操作と誤認しない。
  async #called(
    declaration: ast.Node,
    args: readonly ast.Expression[],
    path: Set<string>,
    inherited: ReadonlyMap<string, ReturnedKind>,
  ): Promise<AccessKind> {
    if (!ast.isFunctionLikeDeclaration(declaration)) return this.classify(declaration, path, inherited);
    const bindings = new Map(inherited);
    for (let index = 0; index < declaration.parameters.length; index++) {
      const argument = args[index];
      if (argument !== undefined)
        bindings.set(declarationKey(declaration.parameters[index]), await this.#expression(argument, path, inherited));
    }
    return this.classify(declaration, path, bindings);
  }

  // 可変なローカル変数でも、初期値と全代入がドメインの不変操作なら取得ではない。
  // 配列へのpushやprimitiveの再代入はこの証明で許可しない。
  async #domainAccumulator(
    declaration: ast.VariableDeclaration,
    path: Set<string>,
    bindings: ReadonlyMap<string, ReturnedKind>,
  ): Promise<ReturnedKind> {
    if (!(await this.#isDomainValue(declaration.name)) || declaration.initializer === undefined) return "unclassified";
    const key = declarationKey(declaration);
    if (path.has(key)) return "unclassified";
    const nested = new Set(path).add(key);
    const initial = await this.#expression(declaration.initializer, nested, bindings);
    if (initial !== "behavior") return "unclassified";
    const symbol = await this.#checker.getSymbolAtLocation(declaration.name);
    if (symbol === undefined) return "unclassified";
    const references = await this.#checker.getReferencesToSymbolInFile(declaration.getSourceFile().fileName, symbol);
    for (const handle of references) {
      const reference = await handle.resolve();
      if (reference === undefined) return "unclassified";
      const parent = reference.parent;
      if (ast.isBinaryExpression(parent) && parent.left.pos === reference.pos) {
        if (
          parent.operatorToken.kind !== ast.SyntaxKind.EqualsToken ||
          (await this.#expression(parent.right, nested, bindings)) !== "behavior"
        )
          return "unclassified";
      }
    }
    return "behavior";
  }

  async #derived(
    expressions: readonly ast.Expression[],
    path: Set<string>,
    bindings: ReadonlyMap<string, ReturnedKind>,
  ): Promise<AccessKind> {
    const kinds = await Promise.all(expressions.map((expression) => this.#expression(expression, path, bindings)));
    if (kinds.includes("unclassified")) return "unclassified";
    return kinds.includes("getter") ? "getter" : "behavior";
  }
}
