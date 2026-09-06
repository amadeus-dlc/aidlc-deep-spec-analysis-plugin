import { QueryLabel, SkipReason, type TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
import {
  boundedValueSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationSkips } from "./verification-skips.ts";

// SMT クエリ 1 件の判定。主従の裁定（#71 波2）: 判定は命令できる抽象データ型
// ——interpret が吸い出していた status 分類（未決状態は #34 項 3 の
// 三重バグの土壌だった）と witness 材料面を判定自身が所有する。
// 応答と未応答を区別したクエリの状態——判定の内部表現。外からは
// isSat / isUnsat / isUndecided で問う。
type SatisfiabilityModuloTheoriesQueryStatus = "sat" | "unsat" | "unknown" | "budget" | "error" | "missing";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SatisfiabilityModuloTheoriesQueryVerdictParam = {
  status: SatisfiabilityModuloTheoriesQueryStatus;
  decodedModel?: { [path: string]: boolean | number | string };
  core?: string[];
};

export class SatisfiabilityModuloTheoriesQueryVerdict {
  readonly #status: SatisfiabilityModuloTheoriesQueryStatus;
  readonly #decodedModel: { [path: string]: boolean | number | string } | undefined;
  readonly #core: readonly QueryLabel[] | undefined;

  // 未検証の構築引数はParam型として明示し、各生成経路で共有する。
  private constructor(props: SatisfiabilityModuloTheoriesQueryVerdictParam) {
    // child応答と証拠文書の処理予算を一度のsnapshotで適用し、ofからの迂回を防ぐ。
    const snapshot = boundedValueSnapshot(props, { string: 65_536, nodes: 65_536, depth: 4, total: 16_777_216 });
    this.#status = snapshot.status;
    this.#decodedModel = snapshot.decodedModel;
    this.#core = snapshot.core === undefined ? undefined : snapshot.core.map((label) => QueryLabel.of(label));
  }

  static parse(
    props: SatisfiabilityModuloTheoriesQueryVerdictParam,
  ): Result<SatisfiabilityModuloTheoriesQueryVerdict, ParseError> {
    return parseConstruction(() => new SatisfiabilityModuloTheoriesQueryVerdict(props));
  }

  static of(props: SatisfiabilityModuloTheoriesQueryVerdictParam): SatisfiabilityModuloTheoriesQueryVerdict {
    return new SatisfiabilityModuloTheoriesQueryVerdict(props);
  }

  static missing(): SatisfiabilityModuloTheoriesQueryVerdict {
    return new SatisfiabilityModuloTheoriesQueryVerdict({ status: "missing" });
  }

  isMissing(): boolean {
    return this.#status === "missing";
  }

  // 欠落は応答契約の不成立。実際に返った未決状態の既存文言とは区別する。
  skipsFor(targets: TargetIdentifiers, what: string): VerificationSkips {
    if (!this.isUndecided()) return VerificationSkips.of([]);
    const reason = this.isMissing() ? SkipReason.unrecognizedFormat() : SkipReason.timeout();
    const detail = this.isMissing() ? `${what} returned no solver result` : `${what} exceeded the solver budget`;
    return VerificationSkips.of([...targets].map((target) => VerificationSkipped.of({ target, reason, detail })));
  }

  isSat(): boolean {
    return this.#status === "sat";
  }

  isUnsat(): boolean {
    return this.#status === "unsat";
  }

  // 未決（unknown / budget / error / missing）。理由の違いはskipsForが所有する。
  isUndecided(): boolean {
    return this.#status !== "sat" && this.#status !== "unsat";
  }

  // witness 材料面: ラベル→対象の写像に使う生順の core。
  coreLabels(): readonly QueryLabel[] {
    return [...(this.#core ?? [])];
  }

  // witness 材料面: 文書に載る整列済み core。
  sortedCore(): string[] {
    return (this.#core ?? []).map((label) => label.asString()).sort();
  }

  // witness 材料面: 復号済みモデル（欠けは空——凍結挙動）。
  witnessModel(): { [path: string]: boolean | number | string } {
    return { ...(this.#decodedModel ?? {}) };
  }

  equals(other: SatisfiabilityModuloTheoriesQueryVerdict): boolean {
    const leftModel = this.#decodedModel ?? {};
    const rightModel = other.#decodedModel ?? {};
    const leftKeys = Object.keys(leftModel).sort();
    const rightKeys = Object.keys(rightModel).sort();
    const modelsEqual =
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && leftModel[key] === rightModel[key]);
    const leftCore = this.#core ?? [];
    const rightCore = other.#core ?? [];
    return (
      this.#status === other.#status &&
      modelsEqual &&
      leftCore.length === rightCore.length &&
      leftCore.every((label, index) => label.equals(rightCore[index] as (typeof leftCore)[number]))
    );
  }
}
