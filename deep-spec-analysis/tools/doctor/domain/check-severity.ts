// doctor 検査行の深刻度——"error" は /aidlc --doctor を失敗させ、"advisory" は
// 表示のみ（FR11 / NFR3）。公開語彙（判定書の severity）を知るドメイン
// プリミティブで、`Check` と `ManifestEntry` が共有する（種別規律の裁定 18、
// 2026-09-02——旧型別名を吸収）。
export class CheckSeverity {
  readonly #value: "error" | "advisory";

  private constructor(value: "error" | "advisory") {
    this.#value = value;
  }

  static error(): CheckSeverity {
    return new CheckSeverity("error");
  }

  static advisory(): CheckSeverity {
    return new CheckSeverity("advisory");
  }

  // 欠けたとき doctor を止めるか。
  blocksDoctor(): boolean {
    return this.#value === "error";
  }

  isAdvisory(): boolean {
    return this.#value === "advisory";
  }

  equals(other: CheckSeverity): boolean {
    return this.#value === other.#value;
  }

  // 判定書へ載せる公開トークン。
  asString(): "error" | "advisory" {
    return this.#value;
  }
}
