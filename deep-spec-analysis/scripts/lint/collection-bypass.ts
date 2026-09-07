// ファーストクラスコレクションの操作契約を迂回する経路の検出。
//
// 規則:
//   - コレクションを `for...of` で走査しない。
//   - コレクションを spread（`[...c]`、`f(...c)`）で配列へ展開しない。
//   - コレクションを `Array.from(c)` で配列へ写さない。
//   - コレクションの `toArray()` を呼ばない。
//
// 迂回すると、その型が持つ `map`・`filter`・`combine`・`foldLeft`・`exists`・
// `include`・`at`・`head`・`tail`・`count`・`isEmpty` の契約を素通りして、
// 配列の操作へ落ちる。契約側に無い操作が要るなら、その型に意味のある名前で
// 生やすのが筋であり、呼出側で配列へ降りるのは筋ではない。
//
// 判定は型で行う。式の型（およびその基底）が共通契約の宣言へ辿り着くものだけを
// コレクションと見なすので、同名のメソッドを持つ無関係な配列や `Set` は拾わない。
//
// コレクション自身の実装（共通基底を継承するクラスの本体）は対象外にする。反復と
// 配列化はその型が担う実装そのもので、迂回ではない。
//
// 適用範囲は層で切る（オーナー裁定 2026-09-07）。インターフェイスアダプタ層と
// 合成ルートは外界との境界で、ドメインのモデルを SMT や Quint の本文へ翻訳する
// のが責務そのものだから、反復も配列化も許す。ドメイン層・ユースケース層・
// infrastructure 層では、配列や反復へ降りることは契約の迂回でしかないので許さない。
//
// `tests/` と `scripts/` はどの規則の対象にもしない。テストはコレクションの
// 公開面（反復子を含む）が約束どおりかを確かめる場所であり、その反復そのものを
// 禁じると契約を検証できなくなる。

import { realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as ast from "typescript/unstable/ast";
import { API, type Checker, type Type } from "typescript/unstable/async";

/** 共通契約の宣言名。型とその基底のどれかがこれに一致すればコレクションと見なす。 */
const CONTRACT_NAMES: ReadonlySet<string> = new Set([
  "NonEmptyFirstClassCollection",
  "FirstClassCollection",
  "NonEmptyFirstClassCollectionBase",
  "FirstClassCollectionBase",
]);

export type CollectionBypassRule = "for-of-traversal" | "spread-materialization" | "array-from" | "to-array";

/**
 * 免除。走査そのものを契約の操作へ移すと意味か読みやすさが壊れる箇所を、
 * 理由付きで表にする——暗黙の除外や名前の部分一致による例外を作らない。
 *
 * `count` は現に残っている件数。実際がこれを超えれば新しい迂回として落ちるし、
 * 下回れば表が陳腐化したとして落ちる。免除を増やすのも減らすのも表の更新を伴う。
 */
export interface CollectionBypassExemption {
  readonly path: string;
  readonly rule: CollectionBypassRule;
  readonly count: number;
  readonly reason: string;
}

const EXEMPTIONS: readonly CollectionBypassExemption[] = [
  {
    path: "src/design/domain/design-unit-declaration.ts",
    rule: "for-of-traversal",
    count: 5,
    reason: "1 周で seenIds・businessRuleReferencesUsed・errors の 3 つへクロージャ越しに書く検査",
  },
  {
    path: "src/design/domain/design-unit.ts",
    rule: "for-of-traversal",
    count: 4,
    reason: "lowered() は OB-n の採番器を節をまたいで共有する 1 つの手続きで、早期 return を含む",
  },
  {
    path: "src/design/domain/lowered-unit.ts",
    rule: "for-of-traversal",
    count: 1,
    reason: "採番器の枯渇で err を返す早期 return",
  },
  {
    path: "src/design/domain/lowering-index.ts",
    rule: "for-of-traversal",
    count: 1,
    reason: "TargetIdentifier.of が不適法 id で送出することが検査の実体——exists へ移すと例外の kind・raw が変わる",
  },
  {
    path: "src/design/domain/sibling-verdict-document.ts",
    rule: "for-of-traversal",
    count: 2,
    reason: "remap の分岐で早期 return し、かつ蓄積器が複数",
  },
  {
    path: "src/design/domain/unit-refinement-plan.ts",
    rule: "for-of-traversal",
    count: 2,
    reason: "1 周で obligations・transitions・gaps へ同時に書く",
  },
  {
    path: "src/design/usecase/verify-design-quint-usecase.ts",
    rule: "for-of-traversal",
    count: 1,
    reason: "report・probesUsed・machine を同時に更新しつつ時計と予算を参照する探索ループ",
  },
  {
    path: "src/requirements/domain/functional-requirement-reference-claim.ts",
    rule: "for-of-traversal",
    count: 2,
    reason: "走査中に呼び手の Map を副作用で更新する",
  },
];

export interface CollectionBypassDiagnostic {
  readonly rule: CollectionBypassRule;
  /** パッケージルートからの相対パス（`/` 区切り）。 */
  readonly path: string;
  readonly line: number;
  readonly column: number;
  /** 迂回された式の逐語（最大 120 文字）。 */
  readonly excerpt: string;
}

export interface CollectionBypassReport {
  readonly checkedFiles: number;
  readonly diagnostics: readonly CollectionBypassDiagnostic[];
}

interface Candidate {
  readonly rule: CollectionBypassRule;
  /** 診断の位置に使う節点。 */
  readonly node: ast.Node;
  /** 型を見る式。 */
  readonly receiver: ast.Node;
}

/**
 * 規則を課す層。パッケージルートからの相対パス（`/` 区切り）で判定する。
 * 免除は表にする——暗黙の除外や名前の部分一致による例外を作らない。
 */
const GOVERNED_LAYERS: readonly RegExp[] = [
  /^src\/[^/]+\/domain\//u,
  /^src\/[^/]+\/usecase\//u,
  /^src\/[^/]+\/infrastructure\//u,
];

function isTargetSource(path: string, root: string): boolean {
  const normalized = relative(root, path).replaceAll("\\", "/");
  return (
    /^src\/.+\.ts$/.test(normalized) &&
    !normalized.includes("/node_modules/") &&
    GOVERNED_LAYERS.some((governed) => governed.test(normalized))
  );
}

function excerptOf(node: ast.Node, source: ast.SourceFile): string {
  const text = node.getText(source).replaceAll(/\s+/gu, " ");
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

async function typeNames(checker: Checker, type: Type, seen: Set<number>): Promise<readonly string[]> {
  if (seen.has(type.id)) return [];
  seen.add(type.id);
  const names: string[] = [];
  const symbol = await type.getSymbol();
  if (symbol !== undefined) names.push(symbol.name);
  for (const base of (await type.getBaseTypes()) ?? []) names.push(...(await typeNames(checker, base, seen)));
  return names;
}

async function isCollectionType(checker: Checker, type: Type | undefined): Promise<boolean> {
  if (type === undefined) return false;
  return (await typeNames(checker, type, new Set())).some((name) => CONTRACT_NAMES.has(name));
}

/**
 * 共通契約を名乗るクラスの本体に含まれる節点か。`extends` でも `implements` でも
 * 契約名を挙げていればその型はコレクションの実装であり、走査と配列化は迂回ではない。
 */
function insideCollectionClass(node: ast.Node, source: ast.SourceFile): boolean {
  for (let current: ast.Node | undefined = node.parent; current !== undefined; current = current.parent) {
    if (!ast.isClassDeclaration(current) && !ast.isClassExpression(current)) continue;
    for (const clause of current.heritageClauses ?? [])
      for (const expression of clause.types) if (CONTRACT_NAMES.has(expression.expression.getText(source))) return true;
  }
  return false;
}

function candidatesIn(source: ast.SourceFile): readonly Candidate[] {
  const candidates: Candidate[] = [];
  const visit = (node: ast.Node): void => {
    if (ast.isForOfStatement(node)) candidates.push({ rule: "for-of-traversal", node, receiver: node.expression });
    else if (ast.isSpreadElement(node))
      candidates.push({ rule: "spread-materialization", node, receiver: node.expression });
    else if (ast.isCallExpression(node) && ast.isPropertyAccessExpression(node.expression)) {
      const access = node.expression;
      const member = access.name.getText(source);
      if (member === "toArray" && node.arguments.length === 0)
        candidates.push({ rule: "to-array", node, receiver: access.expression });
      else if (member === "from" && access.expression.getText(source) === "Array" && node.arguments[0] !== undefined)
        candidates.push({ rule: "array-from", node, receiver: node.arguments[0] });
    }
    node.forEachChild(visit);
  };
  visit(source);
  return candidates;
}

/**
 * 免除表を突き合わせる。表が許す件数までは落とし、超えた分は残す。
 * 表が現実より多くを免除していれば、陳腐化した行として診断に足す。
 */
function applyExemptions(
  diagnostics: readonly CollectionBypassDiagnostic[],
  exemptions: readonly CollectionBypassExemption[],
): readonly CollectionBypassDiagnostic[] {
  const remaining = new Map(exemptions.map((entry) => [`${entry.path}\u0000${entry.rule}`, entry.count]));
  const kept: CollectionBypassDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.path}\u0000${diagnostic.rule}`;
    const allowed = remaining.get(key);
    if (allowed === undefined || allowed === 0) kept.push(diagnostic);
    else remaining.set(key, allowed - 1);
  }
  for (const entry of exemptions) {
    const unused = remaining.get(`${entry.path}\u0000${entry.rule}`) ?? 0;
    if (unused > 0)
      kept.push({
        rule: entry.rule,
        path: entry.path,
        line: 0,
        column: 0,
        excerpt: `免除表が ${unused} 件多く免除しています（${entry.reason}）。count を実際の件数へ直すか、行を削ってください。`,
      });
  }
  return kept;
}

export async function lintCollectionBypass(
  configFile: string,
  exemptions: readonly CollectionBypassExemption[] = EXEMPTIONS,
): Promise<CollectionBypassReport> {
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
    if (files.length === 0) throw new Error(`No governed src TypeScript files found: ${config}`);
    const diagnostics: CollectionBypassDiagnostic[] = [];
    for (const file of files) {
      const source = await project.program.getSourceFile(file);
      if (source === undefined) throw new Error(`TypeScript source could not be loaded: ${file}`);
      const path = relative(root, file).replaceAll("\\", "/");
      for (const candidate of candidatesIn(source)) {
        if (insideCollectionClass(candidate.node, source)) continue;
        if (!(await isCollectionType(project.checker, await project.checker.getTypeAtLocation(candidate.receiver))))
          continue;
        const position = source.getLineAndCharacterOfPosition(candidate.node.getStart());
        diagnostics.push({
          rule: candidate.rule,
          path,
          line: position.line + 1,
          column: position.character + 1,
          excerpt: excerptOf(candidate.node, source),
        });
      }
    }
    diagnostics.sort(
      (a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule),
    );
    return { checkedFiles: files.length, diagnostics: applyExemptions(diagnostics, exemptions) };
  } finally {
    await api.close();
  }
}
