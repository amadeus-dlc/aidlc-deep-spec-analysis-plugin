import type { ParseError } from "@deep-spec/kernel-infrastructure";
import type { Expression } from "./expression.ts";
import { IllegalArgumentException, parseConstruction, boundedValueSnapshot, canonicalStringify, type Result } from "@deep-spec/kernel-infrastructure";

// 式の木——published language の `Expression`（JSON の形、恒久除外）を包む
// kernel の値オブジェクト。木の走査・prime 参照の検出・参照パスの列挙・正準
// 同一性は木自身の知識（種別規律の裁定 2・4、2026-09-02。旧随伴 class
// `Expressions` と design の `ExpressionCanonicalKey` を吸収）。
// 境界（JSON・コンパイラ）へは `asExpression` で戻す。
export class ExpressionTree {
  readonly #root: Expression;

  private constructor(root: Expression) {
    // 生データを読み直さず、予算内のスナップショットへ固定してから式固有の契約を検査する。
    const snapshot = boundedValueSnapshot(root, { string: 4096, nodes: 100_000, depth: 258, total: 16_777_216 });
    // コピー前のサイズ契約: 10,000ノード、深さ128、各文字列4,096コード単位。
    let nodes = 0;
    const measure = (node: Expression, depth: number): void => {
      if (++nodes > 10_000 || depth > 128 || (node.args?.length ?? 0) > 10_000 - nodes) {
        throw new IllegalArgumentException({ kind: "expression-too-large" });
      }
      if ((node.op?.length ?? 0) > 128 || (node.path?.length ?? 0) > 257 || (typeof node.value === "string" && node.value.length > 4096)) {
        throw new IllegalArgumentException({ kind: "expression-token-too-long" });
      }
      for (const child of node.args ?? []) measure(child, depth + 1);
    };
    measure(snapshot, 0);
    // 入力の所有権を引き取らず、独立した不変の木を持つ。寛容な復元が運ぶ
    // 未知のキーや不正な形も、正規化せずコピーする。
    const visited = new WeakSet<object>();
    const freeze = (value: object): void => {
      if (visited.has(value)) return;
      visited.add(value);
      for (const child of Object.values(value)) {
        if (child !== null && typeof child === "object") freeze(child);
      }
      Object.freeze(value);
    };
    freeze(snapshot);
    this.#root = snapshot;
  }

  static of(root: Expression): ExpressionTree {
    return new ExpressionTree(root);
  }

  static parse(root: Expression): Result<ExpressionTree, ParseError> {
    return parseConstruction(() => new ExpressionTree(root));
  }

  asExpression(): Expression {
    return this.#root;
  }

  // 前順走査——訪問順は「自ノード → args の宣言順」で凍結（PR7）。
  walk(visit: (node: Expression) => void): void {
    const go = (e: Expression): void => {
      visit(e);
      for (const a of e.args ?? []) go(a);
    };
    go(this.#root);
  }

  // prime 参照（`x'`）をどこかに含むか。
  usesPrime(): boolean {
    let found = false;
    this.walk((node) => {
      if (node.op === "ref" && node.prime === true) found = true;
    });
    return found;
  }

  // 参照する属性パス——重複なし、素の辞書順（写像式の参照検査の凍結順）。
  referencedPaths(): readonly string[] {
    const refs = new Set<string>();
    this.walk((node) => {
      if (node.op === "ref" && typeof node.path === "string") refs.add(node.path);
    });
    return [...refs].sort();
  }

  // path への prime 代入（`path'` の参照）を含むか。
  assignsPrimed(path: string): boolean {
    let assigned = false;
    this.walk((node) => {
      if (node.op === "ref" && node.prime === true && node.path === path) assigned = true;
    });
    return assigned;
  }

  // 正準同一性——shadow（包摂）検出が「効果が同一か」を判定する比較。
  isCanonicallyEqual(other: ExpressionTree): boolean {
    return canonicalStringify(this.#root) === canonicalStringify(other.#root);
  }
}
