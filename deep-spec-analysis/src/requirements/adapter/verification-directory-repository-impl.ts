// VerificationDirectory の実 Gateway 実装。保存先／読出元は集約の識別子
// （verify ディレクトリ）から導出する。集約は「何を公開するか」だけを決め、
// この実装は「どう公開するか」——直列化・lock・fencing・原子的な置換——を
// 実装詳細として閉じ込める。
//
// findByDirectory はクロスチェックの取得規則：cross-check.json を除く *.json を
// ファイル名順で読み、読めないファイルは型のある失敗にする。公開済みの
// cross-check.json があれば集約のクロスチェックとして載せる。
//
// store は finalization：lock の中で「load 以降に兄弟が変わっていないか」を
// disk と突き合わせ（変わっていれば stale なクロスチェックを公開せずに失敗を
// 返す）、集約の候補とクロスチェックを render し、既存 cross-check の無効化・
// 候補の公開・クロスチェックの公開を、それぞれの直前の token fencing つきで
// 行う。非公開の temp／stale name は `*.json` にせず兄弟列挙へ混ぜない。

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import type { Json } from "@deep-spec/kernel-infrastructure";
import type { DirectoryFinalizationLockOutcome, ProcessLiveness } from "@deep-spec/kernel-adapter";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import { DirectoryFinalizationLock, SystemClock, writeFileAtomically } from "@deep-spec/kernel-adapter";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { VerificationReport } from "@deep-spec/requirements-domain";
import { VerificationDirectory, VerificationReports } from "@deep-spec/requirements-domain";
import type { VerificationDirectoryRepository } from "@deep-spec/requirements-usecase";
import {
  parseSiblingReportDocument,
  renderVerificationReportBytes,
} from "./verification-report-serializer.ts";

const CROSS_CHECK_BASENAME = "cross-check.json";
// 非公開の stale name（`*.json` ではないので兄弟列挙にも doctor の走査にも
// 現れない）。同一ディレクトリなので rename は原子的。
const STALE_CROSS_CHECK_BASENAME = ".cross-check.stale";
// 要件の verify ディレクトリ（deep-spec-verify/）の finalization lock 名。設計
// とはディレクトリが分かれるので衝突はしないが、運用者が取り違えないように
// コンテキストごとに名前を分ける。
export const VERIFICATION_LOCK_BASENAME = ".deep-spec-finalization.lock";
const encoder = new TextEncoder();

// 注入されなかった場合の既定 probe。自 PID を知らず他 PID も判定できないので
// stale 回復は起きない（fail-closed）。実 probe は合成ルートが注入する。
const UNPROBED_LIVENESS: ProcessLiveness = {
  self: () => 0,
  statusOf: () => "unknown",
};

function causeOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// lock の内部結果を、区別可能なまま外向きの cause 文字列へ写す。
function lockCauseOf(outcome: DirectoryFinalizationLockOutcome): string {
  return "cause" in outcome ? `${outcome.kind}: ${outcome.cause}` : outcome.kind;
}

// 突き合わせは文書像で行う——adapter のバイト列を集約に持たせないため。
function documentsByFileName(reports: readonly VerificationReport[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const report of reports) out.set(report.id().fileName(), JSON.stringify(report.toDocument()));
  return out;
}

export class VerificationDirectoryRepositoryImpl implements VerificationDirectoryRepository {
  readonly #lock: DirectoryFinalizationLock;

  constructor(lock: DirectoryFinalizationLock = new DirectoryFinalizationLock(new SystemClock(), UNPROBED_LIVENESS, VERIFICATION_LOCK_BASENAME)) {
    this.#lock = lock;
  }

  findByDirectory(directory: ArtifactPath): Result<VerificationDirectory, RepositoryError> {
    const siblings = this.#siblingsOf(directory);
    if (!siblings.ok) return err(siblings.error);
    const crossPath = join(directory.asString(), CROSS_CHECK_BASENAME);
    if (!existsSync(crossPath)) {
      return ok(VerificationDirectory.of(directory, VerificationReports.of(siblings.value), null));
    }
    // 公開済みクロスチェックは導出物であって入力ではない：読めなければ不在と
    // して扱い、次の成功実行に組み直させる。型のある失敗にするのは比較へ参加
    // する兄弟 backend 文書だけ。
    const crossCheck = this.#readReport(directory, CROSS_CHECK_BASENAME);
    return ok(VerificationDirectory.of(directory, VerificationReports.of(siblings.value), crossCheck.ok ? crossCheck.value : null));
  }

  store(aggregate: VerificationDirectory): Result<void, RepositoryError> {
    const directory = aggregate.directory();
    const directoryPath = directory.asString();
    const candidate = aggregate.candidate();
    if (candidate === null) {
      // 公開すべき候補を持たない集約は finalization の入力ではない——黙って
      // 成功させず、型のある失敗として運ぶ。
      return err({ kind: "io-failed", operation: "write", path: directoryPath, cause: "no finalization candidate" });
    }
    try {
      mkdirSync(directoryPath, { recursive: true });
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: directoryPath, cause: causeOf(e) });
    }
    const lockPath = this.#lock.canonicalPathOf(directory);
    const acquired = this.#lock.acquire(directory);
    if (acquired.kind !== "acquired" && acquired.kind !== "recovered") {
      return err({ kind: "io-failed", operation: "write", path: lockPath, cause: lockCauseOf(acquired) });
    }
    let outcome: Result<void, RepositoryError>;
    let released: DirectoryFinalizationLockOutcome;
    try {
      outcome = this.#publish(aggregate, candidate, directory);
    } finally {
      // panicも伝播させたままロックを解放する。成功結果へ変換しない。
      released = this.#lock.release(directory);
    }
    if (released.kind !== "released" && outcome.ok) {
      return err({ kind: "io-failed", operation: "write", path: lockPath, cause: lockCauseOf(released) });
    }
    return outcome;
  }

  #publish(
    aggregate: VerificationDirectory,
    candidate: VerificationReport,
    directory: ArtifactPath,
  ): Result<void, RepositoryError> {
    const directoryPath = directory.asString();
    const backendPath = join(directoryPath, candidate.id().fileName());
    const crossPath = join(directoryPath, CROSS_CHECK_BASENAME);
    const stalePath = join(directoryPath, STALE_CROSS_CHECK_BASENAME);
    // lock の中で兄弟を観測し、集約が load したときの姿と突き合わせる。ここで
    // 差が出るなら集約のクロスチェックは既に古い——公開しない。
    const unchanged = this.#siblingsUnchanged(aggregate, candidate, directory);
    if (!unchanged.ok) return err(unchanged.error);
    // 公開する文書を render する。ここまでの失敗では公開ファイルを変えない。
    const crossCheck = aggregate.crossCheck();
    const backendBytes = renderVerificationReportBytes(candidate);
    const crossBytes = crossCheck === null ? null : renderVerificationReportBytes(crossCheck);
    // 既存 cross-check を public path から先に外す。
    if (!this.#lock.holdsOwnership(directory)) return this.#fenced(directory, crossPath);
    if (existsSync(crossPath)) {
      try {
        renameSync(crossPath, stalePath);
      } catch (e) {
        return err({ kind: "io-failed", operation: "write", path: crossPath, cause: causeOf(e) });
      }
    }
    // backend report を temp + rename で公開する。
    if (!this.#lock.holdsOwnership(directory)) return this.#fenced(directory, backendPath);
    try {
      writeFileAtomically(backendPath, encoder.encode(backendBytes));
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: backendPath, cause: causeOf(e) });
    }
    // 新しい cross-check を公開する。backend 公開後に古い cross-check を戻さない
    // ——導けなかったときは欠落のまま次の成功実行に任せる。
    if (crossBytes !== null) {
      if (!this.#lock.holdsOwnership(directory)) return this.#fenced(directory, crossPath);
      try {
        writeFileAtomically(crossPath, encoder.encode(crossBytes));
      } catch (e) {
        return err({ kind: "io-failed", operation: "write", path: crossPath, cause: causeOf(e) });
      }
    }
    try {
      rmSync(stalePath, { force: true });
    } catch {
      // 非公開 stale の掃除失敗は公開結果を変えない（次回の rename が上書きする）。
    }
    return ok(undefined);
  }

  // load 以降に候補以外の兄弟が変わっていないかを disk と突き合わせる。増減も
  // 内容の変化も競合として扱う——古い兄弟集合から導いたクロスチェックを最新
  // として公開しないため。
  #siblingsUnchanged(
    aggregate: VerificationDirectory,
    candidate: VerificationReport,
    directory: ArtifactPath,
  ): Result<void, RepositoryError> {
    const observed = this.#siblingsOf(directory);
    if (!observed.ok) return err(observed.error);
    const candidateFileName = candidate.id().fileName();
    const onDisk = documentsByFileName(observed.value.filter((r) => r.id().fileName() !== candidateFileName));
    const loaded = documentsByFileName(aggregate.reports().toArray().filter((r) => r.id().fileName() !== candidateFileName));
    let same = onDisk.size === loaded.size;
    if (same) {
      for (const [fileName, document] of loaded) {
        if (onDisk.get(fileName) !== document) {
          same = false;
          break;
        }
      }
    }
    if (same) return ok(undefined);
    return err({
      kind: "io-failed",
      operation: "write",
      path: directory.asString(),
      cause: "conflict: sibling set changed since load",
    });
  }

  // cross-check.json を除く *.json をファイル名順で読む。読めない兄弟文書を
  // 黙って除かない——型のある失敗として運ぶ。
  #siblingsOf(directory: ArtifactPath): Result<VerificationReport[], RepositoryError> {
    // まだ作られていない verify ディレクトリは「report がまだ 1 つも無い」で
    // あって読込の失敗ではない——初回実行の集約は空で解決する（作成は store）。
    if (!existsSync(directory.asString())) return ok([]);
    let entries: string[];
    try {
      entries = readdirSync(directory.asString())
        .filter((f) => f.endsWith(".json") && f !== CROSS_CHECK_BASENAME)
        .sort();
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: directory.asString(), cause: causeOf(e) });
    }
    const reports: VerificationReport[] = [];
    for (const file of entries) {
      const report = this.#readReport(directory, file);
      if (!report.ok) return err(report.error);
      reports.push(report.value);
    }
    return ok(reports);
  }

  // 1 文書の読込。JSON 構文と文書の形の不正はいずれも型のある失敗にする。
  #readReport(directory: ArtifactPath, fileName: string): Result<VerificationReport, RepositoryError> {
    const path = join(directory.asString(), fileName);
    let raw: Json;
    try {
      raw = JSON.parse(readFileSync(path, "utf-8")) as Json;
    } catch (e) {
      return err({ kind: "corrupt", path, cause: causeOf(e) });
    }
    const parsed = parseSiblingReportDocument(directory, fileName, raw);
    return parsed.ok ? ok(parsed.value) : err({ kind: "corrupt", path, cause: parsed.error });
  }

  #fenced(directory: ArtifactPath, path: string): Result<void, RepositoryError> {
    return err({
      kind: "io-failed",
      operation: "write",
      path,
      cause: `lock-fenced: ${this.#lock.canonicalPathOf(directory)} is no longer held by this writer`,
    });
  }
}
