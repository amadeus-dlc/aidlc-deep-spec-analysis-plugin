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

import { FrRefs, TargetIds, IdOrder } from "../../kernel/domain/index.ts";
import type { CheckFamily } from "./check-family.ts";
import { type CheckFamilies } from "./check-families.ts";
import { Findings } from "./findings.ts";
import { Skips } from "./skips.ts";
import type { Finding } from "./finding.ts";
import type { UnitName } from "./unit-name.ts";
import { WitnessRefs } from "./witness-refs.ts";
import type { WitnessRef } from "./witness-ref.ts";
import type { Skipped } from "./skipped.ts";

export class CheckFamilyLedger {
  readonly #families: CheckFamilies;
  readonly #unit: UnitName | undefined;
  readonly #findings: Finding[] = [];
  readonly #skipped: Skipped[] = [];
  readonly #failed = new Set<string>();
  readonly #skippedFamilies = new Set<string>();

  private constructor(families: CheckFamilies, unit?: UnitName) {
    this.#families = families;
    this.#unit = unit;
  }

  static of(families: CheckFamilies, unit?: UnitName): CheckFamilyLedger {
    return unit === undefined ? new CheckFamilyLedger(families) : new CheckFamilyLedger(families, unit);
  }

  finding(family: CheckFamily, kind: string, targets: string[], refs: WitnessRef[], detail: string, frRefs: string[] = []): void {
    const f: Finding = {
      kind,
      frRefs: FrRefs.of(IdOrder.sortedUnique(frRefs, IdOrder.compare)),
      targets: TargetIds.of(IdOrder.sortedUnique(targets, IdOrder.compare)),
      witness: { refs: WitnessRefs.of(refs) },
      detail: family.prefixedDetail(detail),
    };
    if (this.#unit !== undefined) f.unit = this.#unit.asString();
    this.#findings.push(f);
    this.#failed.add(family.asString());
  }

  skip(family: CheckFamily, reason: string, detail: string): void {
    const s: Skipped = { target: family.asCheckTarget(), reason, detail };
    if (this.#unit !== undefined) s.unit = this.#unit.asString();
    this.#skipped.push(s);
    this.#skippedFamilies.add(family.asString());
  }

  findings(): Findings {
    return Findings.of(this.#findings);
  }

  skipped(): Skips {
    return Skips.of(this.#skipped);
  }

  checkedTargets(): TargetIds {
    return TargetIds.of(this.#families.checkedTargetsExcluding(this.#failed, this.#skippedFamilies));
  }
}
