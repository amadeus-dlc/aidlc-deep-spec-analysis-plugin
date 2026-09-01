import type { DesignValue } from "../../design/domain/index.ts";
import type { RefinementQueryStatus } from "./refinement-query-status.ts";

// refinement クエリ 1 件の判定。主従の裁定（#71 波2）: interpret が吸い出して
// いた status 分類と witness 材料面（pre/post の 2 状態トレース込み）を判定
// 自身が所有する。
export class RefinementQueryVerdict {
  readonly #status: RefinementQueryStatus;
  readonly #decodedModel: { [path: string]: DesignValue } | undefined;
  readonly #decodedPostModel: { [path: string]: DesignValue } | undefined;
  readonly #core: string[] | undefined;

  // ドアの引数は無名のインライン署名で運ぶ（主従の裁定・補遺）。
  private constructor(props: { status: RefinementQueryStatus; decodedModel?: { [path: string]: DesignValue }; decodedPostModel?: { [path: string]: DesignValue }; core?: string[] }) {
    this.#status = props.status;
    // 判定の内部状態は外部と参照を共有しない（入出力ともにコピー）。
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#decodedPostModel = props.decodedPostModel === undefined ? undefined : { ...props.decodedPostModel };
    this.#core = props.core === undefined ? undefined : [...props.core];
  }

  static reconstitute(props: { status: RefinementQueryStatus; decodedModel?: { [path: string]: DesignValue }; decodedPostModel?: { [path: string]: DesignValue }; core?: string[] }): RefinementQueryVerdict {
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
    return [...(this.#core ?? [])].sort();
  }

  // witness 材料面: 復号済みモデル（欠けは空——凍結挙動）。
  witnessModel(): { [path: string]: DesignValue } {
    return { ...(this.#decodedModel ?? {}) };
  }

  // witness 材料面: ワンステップシミュレーションの pre/post トレース。
  witnessTrace(): [{ [path: string]: DesignValue }, { [path: string]: DesignValue }] {
    return [{ ...(this.#decodedModel ?? {}) }, { ...(this.#decodedPostModel ?? {}) }];
  }
}
