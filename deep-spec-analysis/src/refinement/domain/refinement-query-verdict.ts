import { QueryLabel } from "@deep-spec/kernel-domain";

// refinement クエリ 1 件の判定。主従の裁定（#71 波2）: interpret が吸い出して
// いた status 分類と witness 材料面（pre/post の 2 状態トレース込み）を判定
// 自身が所有する。
// ソルバがクエリ 1 つに返す結果の種類——判定の内部表現（裁定 21）。外からは
// isSat / isUnsat / isUndecided で問う。
// 復号済みモデル（z3 のモデルを属性パス → 値へ解いたもの。安全整数範囲外は
// 十進文字列——凍結解除 #34 項 4）。
type RefinementQueryStatus = "sat" | "unsat" | "unknown" | "budget" | "error";

export class RefinementQueryVerdict {
  readonly #status: RefinementQueryStatus;
  readonly #decodedModel: { [path: string]: boolean | number | string } | undefined;
  readonly #decodedPostModel: { [path: string]: boolean | number | string } | undefined;
  readonly #core: readonly QueryLabel[] | undefined;

  // ドアの引数は無名のインライン署名で運ぶ（主従の裁定・補遺）。
  private constructor(props: { status: RefinementQueryStatus; decodedModel?: { [path: string]: boolean | number | string }; decodedPostModel?: { [path: string]: boolean | number | string }; core?: string[] }) {
    this.#status = props.status;
    // 判定の内部状態は外部と参照を共有しない（入出力ともにコピー）。
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#decodedPostModel = props.decodedPostModel === undefined ? undefined : { ...props.decodedPostModel };
    this.#core = props.core === undefined ? undefined : props.core.map((label) => QueryLabel.reconstitute(label));
  }

  static reconstitute(props: { status: RefinementQueryStatus; decodedModel?: { [path: string]: boolean | number | string }; decodedPostModel?: { [path: string]: boolean | number | string }; core?: string[] }): RefinementQueryVerdict {
    return new RefinementQueryVerdict(props);
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

  // witness 材料面: 文書に載る整列済み core。
  sortedCore(): string[] {
    return (this.#core ?? []).map((label) => label.asString()).sort();
  }

  // witness 材料面: 復号済みモデル（欠けは空——凍結挙動）。
  witnessModel(): { [path: string]: boolean | number | string } {
    return { ...(this.#decodedModel ?? {}) };
  }

  // witness 材料面: ワンステップシミュレーションの pre/post トレース。
  witnessTrace(): [{ [path: string]: boolean | number | string }, { [path: string]: boolean | number | string }] {
    return [{ ...(this.#decodedModel ?? {}) }, { ...(this.#decodedPostModel ?? {}) }];
  }
}
