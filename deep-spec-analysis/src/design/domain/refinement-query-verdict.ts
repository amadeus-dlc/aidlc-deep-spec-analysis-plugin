import { QueryLabel } from "@deep-spec-analysis/kernel-domain";
import {
  boundedValueSnapshot,
  canonicalStringify,
  combinedHash,
  hashOfString,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { sameArray, sameRecord } from "./value-equality.ts";

// refinement クエリ 1 件の判定。主従の裁定（#71 波2）: interpret が吸い出して
// いた status 分類と witness 材料面（pre/post の 2 状態トレース込み）を判定
// 自身が所有する。
// ソルバがクエリ 1 つに返す結果の種類——判定の内部表現（裁定 21）。外からは
// isSat / isUnsat / isUndecided で問う。
// 復号済みモデル（z3 のモデルを属性パス → 値へ解いたもの。安全整数範囲外は
// 十進文字列——凍結解除 #34 項 4）。
type RefinementQueryStatus = "sat" | "unsat" | "unknown" | "budget" | "error";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementQueryVerdictParam = {
  status: RefinementQueryStatus;
  decodedModel?: { [path: string]: boolean | number | string };
  decodedPostModel?: { [path: string]: boolean | number | string };
  core?: string[];
};

export class RefinementQueryVerdict {
  readonly #status: RefinementQueryStatus;
  readonly #decodedModel: { [path: string]: boolean | number | string } | undefined;
  readonly #decodedPostModel: { [path: string]: boolean | number | string } | undefined;
  readonly #core: readonly QueryLabel[] | undefined;

  // 未検証の構築引数はParam型として明示し、各生成経路で共有する。
  private constructor(props: RefinementQueryVerdictParam) {
    // child応答と証拠文書の処理予算を一度のsnapshotで適用し、ofからの迂回を防ぐ。
    const snapshot = boundedValueSnapshot(props, { string: 65_536, nodes: 65_536, depth: 4, total: 16_777_216 });
    this.#status = snapshot.status;
    this.#decodedModel = snapshot.decodedModel;
    this.#decodedPostModel = snapshot.decodedPostModel;
    this.#core = snapshot.core === undefined ? undefined : snapshot.core.map((label) => QueryLabel.of(label));
  }

  static parse(props: RefinementQueryVerdictParam): Result<RefinementQueryVerdict, ParseError> {
    return parseConstruction(() => new RefinementQueryVerdict(props));
  }

  static of(props: RefinementQueryVerdictParam): RefinementQueryVerdict {
    return new RefinementQueryVerdict(props);
  }

  equals(other: RefinementQueryVerdict): boolean {
    return (
      this.#status === other.#status &&
      sameArray(this.#core ?? [], other.#core ?? [], (left, right) => left.equals(right)) &&
      sameRecord(this.#decodedModel ?? {}, other.#decodedModel ?? {}) &&
      sameRecord(this.#decodedPostModel ?? {}, other.#decodedPostModel ?? {})
    );
  }

  hashCode(): number {
    return combinedHash([
      hashOfString(this.#status),
      combinedHash((this.#core ?? []).map((label) => label.hashCode())),
      hashOfString(canonicalStringify(this.#decodedModel ?? {})),
      hashOfString(canonicalStringify(this.#decodedPostModel ?? {})),
    ]);
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
