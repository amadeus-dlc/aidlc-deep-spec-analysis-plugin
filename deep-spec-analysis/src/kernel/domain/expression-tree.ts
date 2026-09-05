import type { Expression } from "./expression.ts";

// 式の木——published language の `Expression`（JSON の形、恒久除外）を包む
// kernel の値オブジェクト。木の走査・prime 参照の検出・参照パスの列挙・正準
// 同一性は木自身の知識（種別規律の裁定 2・4、2026-09-02。旧随伴 class
// `Expressions` と design の `ExpressionCanonicalKey` を吸収）。
// 境界（JSON・コンパイラ）へは `asExpression` で戻す。
type CanonicalNode = null | boolean | number | string | readonly CanonicalNode[] | { readonly [k: string]: CanonicalNode };

// kernel/infrastructure の canonicalStringify（正準 JSON）と同一バイト——
// 同値性は tests が canonicalStringify との突き合わせで機械証明する。
function canonicalKeyOf(value: CanonicalNode): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalKeyOf).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as { readonly [k: string]: CanonicalNode };
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalKeyOf(record[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class ExpressionTree {
  readonly #root: Expression;

  private constructor(root: Parameters<typeof ExpressionTree.of>[0]) {
    // 入力の所有権を引き取らず、独立した不変の木を持つ。寛容な復元が運ぶ
    // 未知のキーや不正な形も、正規化せずコピーする。
    const snapshot = structuredClone(root);
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
    return canonicalKeyOf(this.#root as unknown as CanonicalNode) === canonicalKeyOf(other.#root as unknown as CanonicalNode);
  }
}
