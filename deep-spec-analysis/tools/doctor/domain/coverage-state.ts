// カバレッジ行の状態——検証が無い（unverified）か、検証後に材料が変わった
// （stale）か。要件行と設計行が共有するドメインプリミティブ（種別規律の
// 裁定 19、2026-09-02——旧型別名を吸収）。presenter は `match` で解釈する。
export class CoverageState {
  readonly #value: "unverified" | "stale";

  private constructor(value: "unverified" | "stale") {
    this.#value = value;
  }

  static unverified(): CoverageState {
    return new CoverageState("unverified");
  }

  static stale(): CoverageState {
    return new CoverageState("stale");
  }

  match<T>(handlers: { unverified: () => T; stale: () => T }): T {
    return this.#value === "unverified" ? handlers.unverified() : handlers.stale();
  }

  equals(other: CoverageState): boolean {
    return this.#value === other.#value;
  }
}
