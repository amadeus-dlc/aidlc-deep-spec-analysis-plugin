// CheckFamilyLedger — check family 台帳（無沈黙の中核）。
//
// findings/skips の構築と「checked = 全 family − failed − skipped」の導出を
// 型で所有する。従来は finding の detail 文字列 prefix（`detail.split(":")[0]`）
// と skip の target prefix から family を復元していた——本台帳は family を
// 明示フィールドとして運び、描画（`${family}: ${detail}` / `check:${family}`）
// を凍結挙動として自身が行うため、バイト同一のまま文字列規約への依存が消える。
//
// CQS: finding / skip は void のコマンド、findings / skipped / checkedTargets
// はクエリ。unit は functional センサーのみが持つ（キー順の末尾、凍結）。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { Finding } from "./finding.ts";
import type { WitnessRef } from "./witness-ref.ts";
import type { Skipped } from "./skipped.ts";

export class CheckFamilyLedger {
  readonly #families: readonly string[];
  readonly #unit: string | undefined;
  readonly #findings: Finding[] = [];
  readonly #skipped: Skipped[] = [];
  readonly #failed = new Set<string>();
  readonly #skippedFamilies = new Set<string>();

  constructor(families: readonly string[], unit?: string) {
    this.#families = families;
    this.#unit = unit;
  }

  finding(family: string, kind: string, targets: string[], refs: WitnessRef[], detail: string, frRefs: string[] = []): void {
    const f: Finding = {
      kind,
      frRefs: sortedUnique(frRefs, idCompare),
      targets: sortedUnique(targets, idCompare),
      witness: { refs },
      detail: `${family}: ${detail}`,
    };
    if (this.#unit !== undefined) f.unit = this.#unit;
    this.#findings.push(f);
    this.#failed.add(family);
  }

  skip(family: string, reason: string, detail: string): void {
    const s: Skipped = { target: `check:${family}`, reason, detail };
    if (this.#unit !== undefined) s.unit = this.#unit;
    this.#skipped.push(s);
    this.#skippedFamilies.add(family);
  }

  findings(): readonly Finding[] {
    return this.#findings;
  }

  skipped(): readonly Skipped[] {
    return this.#skipped;
  }

  checkedTargets(): string[] {
    return this.#families.filter((f) => !this.#failed.has(f) && !this.#skippedFamilies.has(f)).map((f) => `check:${f}`);
  }
}
