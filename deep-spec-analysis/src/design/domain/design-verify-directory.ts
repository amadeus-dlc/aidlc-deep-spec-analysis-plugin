// 設計検証ディレクトリの集約ルート（グローバルエンティティ）。識別は verify
// ディレクトリそのもので、一塊として I/O される単位でもある：Repository は
// この集約を保存・検索するだけで、変種メソッドを持たない（オーナー裁定
// 2026-09-04「リポジトリの語彙は保存・検索・取得・削除に閉じる」）。
//
// 中身は 3 つ。backend ごとの report の集合（ファイル名順。backend 名で検索
// されるので要素はエンティティ）、この実行が置こうとしている candidate、そして
// クロスチェック文書。クロスチェックは「導けるとは限らない」可変部なので、
// 集約は absent / present / unreadable を閉じた状態として持つ。unreadable は
// Repository が観測した派生物の障害で、finalizing が兄弟から再導出すると消える。
//
// 不変条件は 2 つ:
//   - backend ごとに report は 1 つ（finalizing は同じ backend を置換する）
//   - crossCheck は不在か、いまの reports から導いたもの——candidate を置いた
//     瞬間に古いクロスチェックは「いまの reports から導いたもの」でなくなる
//     ので、finalizing は必ずそれを落とす（BR2.2／BR2.5）

import type { ArtifactPath, ContentHash, ErrorMessage, FindingsSchema } from "@deep-spec-analysis/kernel-domain";
import { err, IllegalArgumentException, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignModel } from "./design-model.ts";
import type { DesignReport } from "./design-report.ts";
import { DesignReportIdentifier } from "./design-report-identifier.ts";
import { DesignReports } from "./design-reports.ts";

const CROSS_CHECK_BACKEND = "cross-check";

type CrossCheckState =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly report: DesignReport }
  | { readonly kind: "unreadable"; readonly error: ErrorMessage };

export class DesignVerifyDirectory {
  readonly #directory: ArtifactPath;
  readonly #reports: DesignReports;
  readonly #candidate: DesignReport | null;
  readonly #crossCheck: CrossCheckState;

  private constructor(
    directory: ArtifactPath,
    reports: DesignReports,
    candidate: DesignReport | null,
    crossCheck: CrossCheckState,
  ) {
    this.#directory = directory;
    this.#reports = reports;
    this.#candidate = candidate;
    this.#crossCheck = crossCheck;
  }

  // 書かれたディレクトリからの再構成（Repository の findByDirectory 用）。
  // 読み込んだ時点では候補はまだ無い。
  static of(directory: ArtifactPath, reports: DesignReports, crossCheck: DesignReport | null): DesignVerifyDirectory {
    return new DesignVerifyDirectory(
      directory,
      reports,
      null,
      crossCheck === null ? { kind: "absent" } : { kind: "present", report: crossCheck },
    );
  }

  static unreadableCrossCheck(
    directory: ArtifactPath,
    reports: DesignReports,
    error: ErrorMessage,
  ): DesignVerifyDirectory {
    return new DesignVerifyDirectory(directory, reports, null, { kind: "unreadable", error });
  }

  // この実行が公開しようとする report を候補として置く。同じ backend の旧
  // report は置換し、無ければファイル名順の位置へ挿す——読み出し（ファイル名
  // 順）が与える全順序を崩さないため。候補が変わればクロスチェックは「いまの
  // reports から導いたもの」ではなくなるので落とす。
  finalizing(candidate: DesignReport): DesignVerifyDirectory {
    if (!candidate.id().directory().equals(this.#directory)) {
      throw new IllegalArgumentException({ kind: "design-report-directory-mismatch" });
    }
    const fileName = candidate.id().fileName();
    const replaced = this.#reports.exists((sibling) => sibling.id().fileName() === fileName);
    const merged = this.#reports.foldLeft<DesignReport[]>([], (acc, sibling) => {
      acc.push(sibling.id().fileName() === fileName ? candidate : sibling);
      return acc;
    });
    if (!replaced) {
      const at = merged.findIndex((s) => s.id().fileName() > fileName);
      if (at < 0) merged.push(candidate);
      else merged.splice(at, 0, candidate);
    }
    return new DesignVerifyDirectory(this.#directory, DesignReports.of(merged), candidate, { kind: "absent" });
  }

  // 公開する候補の適合と、それに基づく cross-check の導出を一つの操作で行う。
  // model が無いときは導出物を残さない。呼び手は適合の順序を知る必要がない。
  finalizedWith(candidate: DesignReport, model: DesignModel | null, schema: FindingsSchema): DesignVerifyDirectory {
    const staged = this.finalizing(candidate.conformedTo(schema));
    if (model === null) return staged;
    const derived = staged.#reports.crossChecked(
      DesignReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND),
      model,
      candidate.irHash(),
    );
    return new DesignVerifyDirectory(this.#directory, staged.#reports, staged.#candidate, {
      kind: "present",
      report: derived.conformedTo(schema),
    });
  }

  // いまの reports からクロスチェックを導く（同一 irHash の可用文書だけが
  // 比較に参加する規則は DesignReports が持つ）。
  crossChecked(model: DesignModel, irHash: ContentHash): DesignVerifyDirectory {
    const derived = this.#reports.crossChecked(
      DesignReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND),
      model,
      irHash,
    );
    return new DesignVerifyDirectory(this.#directory, this.#reports, this.#candidate, {
      kind: "present",
      report: derived,
    });
  }

  // 設計 IR が読めずクロスチェックを導けない場合。導けないものを stale のまま
  // 残さず、不在にする——次の成功実行が組み直す（BR2.5）。
  withoutCrossCheck(): DesignVerifyDirectory {
    return new DesignVerifyDirectory(this.#directory, this.#reports, this.#candidate, { kind: "absent" });
  }

  // 契約2 への適合。候補とクロスチェックの両方を同じスキーマで適合させる
  // ——公開する文書はどれも同じ 1 つの観測から導かれる（BR1.1）。
  conformedTo(schema: FindingsSchema): DesignVerifyDirectory {
    const candidate = this.#candidate;
    const crossCheck = this.#crossCheck;
    const conformedCandidate = candidate === null ? null : candidate.conformedTo(schema);
    // 候補が変わったら、以前の reports から導いた cross-check は無効。
    const conformedCrossCheck: CrossCheckState =
      conformedCandidate !== candidate || crossCheck.kind === "absent"
        ? { kind: "absent" }
        : crossCheck.kind === "unreadable"
          ? crossCheck
          : { kind: "present", report: crossCheck.report.conformedTo(schema) };
    const reports =
      conformedCandidate === null
        ? this.#reports
        : this.#reports.map((r) => (r.id().fileName() === conformedCandidate.id().fileName() ? conformedCandidate : r));
    return new DesignVerifyDirectory(this.#directory, reports, conformedCandidate, conformedCrossCheck);
  }

  directory(): ArtifactPath {
    return this.#directory;
  }

  // 境界: Repository が「load 後に兄弟が変わっていないか」を突き合わせるための
  // 読み取り面（候補を含む、ファイル名順の全 report）。
  reports(): DesignReports {
    return this.#reports;
  }

  publishedReport(): DesignReport {
    if (this.#candidate === null) throw new Error("defect: no finalized design report candidate");
    return this.#candidate;
  }

  // 境界: この実行が公開する report。load 直後は不在。
  candidate(): DesignReport | null {
    return this.#candidate;
  }

  // 境界: 公開するクロスチェック文書。導けなかったときは ok(null)、読み込んだ
  // 派生物が破損しているときは err(error) として欠如と取得障害を区別する。
  crossCheck(): Result<DesignReport | null, ErrorMessage> {
    if (this.#crossCheck.kind === "present") return ok(this.#crossCheck.report);
    if (this.#crossCheck.kind === "unreadable") return err(this.#crossCheck.error);
    return ok(null);
  }
}
