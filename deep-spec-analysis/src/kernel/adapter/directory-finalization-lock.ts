// 同一 verify ディレクトリの finalization を直列化する directory lock
// （Workflow 1 の 5-7・14）。所有の証拠は canonical lock ディレクトリと、その
// 中の owner metadata（state・128bit token・PID・取得時刻・30 秒 lease）。
//
// 規律:
//   - 取得は canonical path への単発の exclusive create（mkdir は原子的）。
//     既存 lock があっても待機も再試行もしない。
//   - lease 期限切れ「だけ」では奪わない。OS liveness probe が記録 PID の不在を
//     確定でき、metadata 再読で token が不変な場合にだけ、canonical を
//     `<lock>.stale.<old>.<new>` へ atomic rename して回復する。
//   - 回復競合では stale rename と続く exclusive create の両方に勝った 1 つだけ
//     が新 owner。負けた writer は自分が作った stale path だけを掃除する。
//   - 解放は token 一致を確かめてから canonical を `<lock>.cleanup.<owner>` へ
//     atomic rename し、その owner 固有 path だけを削除する。canonical path は
//     どの経路でも直接削除しない（後続 owner の lock を消さないため）。
//
// path は与えられたディレクトリと固定 basename・hex token からだけ導出する
// （入力文字列で任意 path を組み立てない——NFR4／BR7.5）。時計と liveness probe
// は注入する：実時間待ちなしに境界値と live 停止を検証できるようにするため。
//
// verify ディレクトリを finalize する検証コンテキストはどれも同じ直列化を要る
// ので、この lock は kernel/adapter に住む。lock ファイルの名前だけがコンテキ
// ストごとに違う（要件は deep-spec-verify/、設計は deep-spec-design-verify/ と
// ディレクトリが分かれるので衝突はしないが、運用者が見て取り違えないように
// 名前を分ける）——既定は設計の凍結名で、要件側が自分の名前を注入する。

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { Clock } from "@deep-spec/kernel-usecase";
import type { ProcessLiveness } from "./process-liveness.ts";
import type { DirectoryFinalizationLockOutcome } from "./directory-finalization-lock-outcome.ts";

const DESIGN_LOCK_BASENAME = ".deep-spec-design-finalization.lock";
const METADATA_BASENAME = "owner.lockmeta";
const LEASE_MS = 30_000;
// 128 bit。衝突ではなく「他人の cleanup／stale path を掴まない」ことが要点。
const OWNER_TOKEN_BYTES = 16;

// 随伴の非公開型（所有する公開型のファイルに同居してよい）。
interface OwnerMetadata {
  readonly state: string;
  readonly token: string;
  readonly pid: number;
  readonly acquiredAtMs: number;
  readonly leaseExpiresAtMs: number;
}

function causeOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class DirectoryFinalizationLock {
  readonly #clock: Clock;
  readonly #liveness: ProcessLiveness;
  readonly #lockBasename: string;
  // canonical path -> この writer が持つ owner token。
  readonly #ownerTokens: Map<string, string>;

  constructor(clock: Clock, liveness: ProcessLiveness, lockBasename: string = DESIGN_LOCK_BASENAME) {
    this.#clock = clock;
    this.#liveness = liveness;
    this.#lockBasename = lockBasename;
    this.#ownerTokens = new Map();
  }

  // 境界: 失敗を報告する呼び手が指し示す canonical path。
  canonicalPathOf(directory: ArtifactPath): string {
    return join(directory.asString(), this.#lockBasename);
  }

  // 境界: この writer が保持している owner token（未保持なら null）。
  ownerTokenOf(directory: ArtifactPath): string | null {
    return this.#ownerTokens.get(this.canonicalPathOf(directory)) ?? null;
  }

  acquire(directory: ArtifactPath): DirectoryFinalizationLockOutcome {
    const canonical = this.canonicalPathOf(directory);
    const token = randomBytes(OWNER_TOKEN_BYTES).toString("hex");
    const blocked = this.#createOwned(canonical, token);
    if (blocked === null) {
      this.#ownerTokens.set(canonical, token);
      return { kind: "acquired" };
    }
    // 既存 lock がある。ここから先は回復判定だけで、待機も再試行もしない。
    const observed = this.#readMetadata(canonical);
    if (observed === null) {
      return { kind: "lock-contended", cause: `owner metadata is unreadable (${blocked})` };
    }
    if (observed.state !== "held") {
      return { kind: "lock-contended", cause: `owner metadata is in state "${observed.state}"` };
    }
    if (this.#clock.now() < observed.leaseExpiresAtMs) {
      return { kind: "lock-contended", cause: "the lease has not expired" };
    }
    // lease 期限は回復判定を始めてよい時刻にすぎない。死亡は probe が確定する。
    const status = this.#liveness.statusOf(observed.pid);
    if (status !== "absent") {
      return { kind: "lock-contended", cause: `owner process ${observed.pid} is ${status}` };
    }
    const reread = this.#readMetadata(canonical);
    if (reread === null || reread.token !== observed.token) {
      return { kind: "lock-contended", cause: "the lock changed hands during the recovery check" };
    }
    const stale = `${canonical}.stale.${observed.token}.${token}`;
    try {
      renameSync(canonical, stale);
    } catch (e) {
      // canonical を掴めなかった＝他の回復 writer が先に動いた。触らず降りる。
      return { kind: "lock-recovery-failed", cause: causeOf(e) };
    }
    const lost = this.#createOwned(canonical, token);
    // 掃除するのは自分が作った stale path だけ（canonical へは触れない）。
    this.#discard(stale);
    if (lost !== null) {
      return { kind: "lock-recovery-failed", cause: lost };
    }
    this.#ownerTokens.set(canonical, token);
    return { kind: "recovered", displacedToken: observed.token };
  }

  // 各公開の直前の fencing：canonical metadata が held かつ token が自分と一致。
  holdsOwnership(directory: ArtifactPath): boolean {
    const canonical = this.canonicalPathOf(directory);
    const mine = this.#ownerTokens.get(canonical);
    if (mine === undefined) return false;
    const observed = this.#readMetadata(canonical);
    return observed !== null && observed.state === "held" && observed.token === mine;
  }

  release(directory: ArtifactPath): DirectoryFinalizationLockOutcome {
    const canonical = this.canonicalPathOf(directory);
    const mine = this.#ownerTokens.get(canonical);
    if (mine === undefined) {
      return { kind: "lock-release-failed", cause: "this writer does not hold the lock" };
    }
    this.#ownerTokens.delete(canonical);
    const observed = this.#readMetadata(canonical);
    if (observed === null || observed.token !== mine) {
      // 既に他 owner のものになっている。canonical は削除しない。
      return { kind: "lock-release-failed", cause: "the canonical lock is no longer owned by this writer" };
    }
    const cleanup = `${canonical}.cleanup.${mine}`;
    try {
      renameSync(canonical, cleanup);
    } catch (e) {
      // rename に負けた場合も canonical を削除せず fail-closed のまま残す。
      return { kind: "lock-release-failed", cause: causeOf(e) };
    }
    const swept = this.#discard(cleanup);
    if (swept !== null) {
      // canonical は既に空いており後続 writer は取得できる。owner 固有 path だけ
      // が残る。
      return { kind: "cleanup-failed", cause: swept };
    }
    return { kind: "released" };
  }

  // 単発の exclusive create。成功なら null、失敗なら理由を返す。
  #createOwned(canonical: string, token: string): string | null {
    // 取得時刻は canonical 作成の直前に観測する（lease はここから測る）。
    const acquiredAtMs = this.#clock.now();
    try {
      mkdirSync(canonical);
    } catch (e) {
      return causeOf(e);
    }
    const metadata: OwnerMetadata = {
      state: "held",
      token,
      pid: this.#liveness.self(),
      acquiredAtMs,
      leaseExpiresAtMs: acquiredAtMs + LEASE_MS,
    };
    try {
      writeFileSync(join(canonical, METADATA_BASENAME), `${JSON.stringify(metadata)}\n`, "utf-8");
      return null;
    } catch (e) {
      // metadata を書けない lock は所有できない。canonical を直接消さず、自分の
      // token 固有 path へ寄せてから捨てる。
      const cleanup = `${canonical}.cleanup.${token}`;
      try {
        renameSync(canonical, cleanup);
        this.#discard(cleanup);
      } catch {
        // 掃除に失敗しても canonical は直接削除しない（後続の回復に委ねる）。
      }
      return causeOf(e);
    }
  }

  #readMetadata(canonical: string): OwnerMetadata | null {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(canonical, METADATA_BASENAME), "utf-8")) as unknown;
    } catch {
      // 読めない owner metadata は「所有者不明」——呼び手は fail-closed で扱う。
      return null;
    }
    if (typeof raw !== "object" || raw === null) return null;
    const doc = raw as { [k: string]: unknown };
    if (typeof doc.state !== "string" || typeof doc.token !== "string") return null;
    if (typeof doc.pid !== "number" || typeof doc.acquiredAtMs !== "number" || typeof doc.leaseExpiresAtMs !== "number") return null;
    return {
      state: doc.state,
      token: doc.token,
      pid: doc.pid,
      acquiredAtMs: doc.acquiredAtMs,
      leaseExpiresAtMs: doc.leaseExpiresAtMs,
    };
  }

  // owner 固有 path だけを消す（canonical には決して使わない）。
  #discard(ownPath: string): string | null {
    try {
      rmSync(ownPath, { recursive: true, force: true });
      return null;
    } catch (e) {
      return causeOf(e);
    }
  }
}
