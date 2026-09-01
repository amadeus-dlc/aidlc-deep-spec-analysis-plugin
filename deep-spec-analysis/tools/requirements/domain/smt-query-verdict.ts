import type { SmtQueryStatus } from "./smt-query-status.ts";

// SMT クエリ 1 件の判定。主従の裁定（#71 波2）: 判定は命令できる抽象データ型
// ——interpret が吸い出していた status 分類（undecided の 3 状態は #34 項 3 の
// 三重バグの土壌だった）と witness 材料面を判定自身が所有する。
export class SmtQueryVerdict {
  readonly #status: SmtQueryStatus;
  readonly #decodedModel: { [path: string]: boolean | number | string } | undefined;
  readonly #core: string[] | undefined;

  // ドアの引数は無名のインライン署名で運ぶ（主従の裁定・補遺）。
  private constructor(props: { status: SmtQueryStatus; decodedModel?: { [path: string]: boolean | number | string }; core?: string[] }) {
    this.#status = props.status;
    // 判定の内部状態は外部と参照を共有しない（入出力ともにコピー）。
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#core = props.core === undefined ? undefined : [...props.core];
  }

  static reconstitute(props: { status: SmtQueryStatus; decodedModel?: { [path: string]: boolean | number | string }; core?: string[] }): SmtQueryVerdict {
    return new SmtQueryVerdict(props);
  }

  isSat(): boolean {
    return this.#status === "sat";
  }

  isUnsat(): boolean {
    return this.#status === "unsat";
  }

  // 未決（unknown / budget / error）——timeout skip の唯一の判定面。
  isUndecided(): boolean {
    return this.#status !== "sat" && this.#status !== "unsat";
  }

  // witness 材料面: ラベル→対象の写像に使う生順の core。
  coreLabels(): readonly string[] {
    return [...(this.#core ?? [])];
  }

  // witness 材料面: 文書に載る整列済み core。
  sortedCore(): string[] {
    return [...(this.#core ?? [])].sort();
  }

  // witness 材料面: 復号済みモデル（欠けは空——凍結挙動）。
  witnessModel(): { [path: string]: boolean | number | string } {
    return { ...(this.#decodedModel ?? {}) };
  }
}
