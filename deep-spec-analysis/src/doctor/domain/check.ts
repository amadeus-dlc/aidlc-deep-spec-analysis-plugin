import type { CheckSeverity } from "./check-severity.ts";

// doctor 検査行 1 件——合否・label・fix・深刻度。判定書はこの行に自分の
// 直列化面（プロパティ順 pass, label, fix, severity は凍結バイト）を作らせる
// （#71 波27）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type CheckParam = { pass: boolean; label: string; fix?: string; severity: CheckSeverity };

export class Check {
  readonly #pass: boolean;
  readonly #label: string;
  readonly #fix: string | undefined;
  readonly #severity: CheckSeverity;

  private constructor(props: CheckParam) {
    this.#pass = props.pass;
    this.#label = props.label;
    this.#fix = props.fix;
    this.#severity = props.severity;
  }

  static of(props: CheckParam): Check {
    return new Check(props);
  }

  passes(): boolean {
    return this.#pass;
  }

  label(): string {
    return this.#label;
  }

  fix(): string | undefined {
    return this.#fix;
  }

  severity(): CheckSeverity {
    return this.#severity;
  }

  // 判定書の 1 行（凍結のプロパティ順）。
  toDocument(): { pass: boolean; label: string; fix?: string; severity: "error" | "advisory" } {
    return {
      pass: this.#pass,
      label: this.#label,
      ...(this.#fix !== undefined ? { fix: this.#fix } : {}),
      severity: this.#severity.asString(),
    };
  }
}
