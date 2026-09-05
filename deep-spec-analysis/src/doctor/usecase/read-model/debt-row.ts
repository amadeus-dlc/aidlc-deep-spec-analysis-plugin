// 構造的負債の行——どの intent のどの設計成果物に、いくつの参照整合 finding
// があるか。集計は行に件数を問い、presenter は所在ラベルを行に作らせる
// （#71 波27）。
export class DebtRow {
  readonly #space: string;
  readonly #intent: string;
  readonly #artifact: string;
  readonly #findings: number;

  private constructor(props: { space: string; intent: string; artifact: string; findings: number }) {
    this.#space = props.space;
    this.#intent = props.intent;
    this.#artifact = props.artifact;
    this.#findings = props.findings;
  }

  static of(props: { space: string; intent: string; artifact: string; findings: number }): DebtRow {
    return new DebtRow(props);
  }

  findingCount(): number {
    return this.#findings;
  }

  locationLabel(): string {
    return `${this.#space}/${this.#intent} ${this.#artifact}`;
  }
}
