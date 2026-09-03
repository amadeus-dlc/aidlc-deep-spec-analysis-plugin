import type { VerificationFinding } from "./verification-finding.ts";

// v1 バックエンドの kind 順位表（4 kind・未知は 9）と正準ソート。
// 拡張 11-kind 表とは意図的に別実装のまま保つ（統一しない——バイト安全優先。
// 順序互換は tests/kind-rank.test.ts が機械証明）。旧
// verification-finding-order.ts から吸収し、コレクションだけが使う。
// 正準ソートは要素の `compareTo` に問う（kind 順位は kernel の FindingKind——
// v1 の 4 種の相対順序は 11 種の表と一致する、裁定 3-2）。
function sortVerificationFindings(findings: readonly VerificationFinding[]): VerificationFinding[] {
  return [...findings].sort((a, b) => a.compareTo(b));
}

export class VerificationFindings {
  readonly #values: readonly VerificationFinding[];

  private constructor(values: readonly VerificationFinding[]) {
    this.#values = values;
  }

  static of(values: readonly VerificationFinding[]): VerificationFindings {
    return new VerificationFindings([...values]);
  }

  add(value: VerificationFinding): VerificationFindings {
    return new VerificationFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<VerificationFinding> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationFindings {
    return new VerificationFindings(sortVerificationFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly VerificationFinding[] {
    return this.#values;
  }
}
