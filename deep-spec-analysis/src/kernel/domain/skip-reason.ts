// SkipReason — design／refinement／refcheck の各 skip 文書（契約2）が共有する
// reason のドメインプリミティブ（種別規律の裁定 3-2、2026-09-04）。閉集合 9 値
// （契約2 skippedEntry.reason、deep-spec-findings-schema.json が正本）:
// unavailable / timeout / capability / compile-error / waived / absent-input /
// stale-input / ir-version-mismatch / unrecognized-format。
// parse は閉集合の門、reconstitute は逐語——adapter の寛容な hydration 用
// （書かれた文書の降格試験が未知の reason を運びうるため）。閉集合 9 値には
// それぞれ名前付き静的ファクトリがある——domain／usecase が自ら選ぶ理由は
// 文字列を経由せずこの口から得る（種別規律：自由関数を置かない）。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";

const KNOWN_REASONS: ReadonlySet<string> = new Set([
  "unavailable",
  "timeout",
  "capability",
  "compile-error",
  "waived",
  "absent-input",
  "stale-input",
  "ir-version-mismatch",
  "unrecognized-format",
]);

type SkipReasonError = { readonly kind: "unknown-skip-reason"; readonly raw: string };

export class SkipReason {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<SkipReason, SkipReasonError> {
    if (!KNOWN_REASONS.has(raw)) return err({ kind: "unknown-skip-reason", raw });
    return ok(new SkipReason(raw));
  }

  static reconstitute(raw: string): SkipReason {
    return new SkipReason(raw);
  }

  // 閉集合 9 値の名前付きファクトリ（値オブジェクト自身の生成口）。
  static unavailable(): SkipReason {
    return new SkipReason("unavailable");
  }

  static timeout(): SkipReason {
    return new SkipReason("timeout");
  }

  static capability(): SkipReason {
    return new SkipReason("capability");
  }

  static compileError(): SkipReason {
    return new SkipReason("compile-error");
  }

  static waived(): SkipReason {
    return new SkipReason("waived");
  }

  static absentInput(): SkipReason {
    return new SkipReason("absent-input");
  }

  static staleInput(): SkipReason {
    return new SkipReason("stale-input");
  }

  static irVersionMismatch(): SkipReason {
    return new SkipReason("ir-version-mismatch");
  }

  static unrecognizedFormat(): SkipReason {
    return new SkipReason("unrecognized-format");
  }

  asString(): string {
    return this.#value;
  }

  // DesignSkipped.compareTo が守ってきた並び（reason の辞書順）と同じ。
  compareTo(other: SkipReason): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
}
