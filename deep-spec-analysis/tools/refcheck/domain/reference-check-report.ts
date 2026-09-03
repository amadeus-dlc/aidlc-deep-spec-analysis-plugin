// ReferenceCheckReport 集約 — 契約2 の refcheck 文書のドメイン表現。
//
// ドメインは型付きの語彙（findings / skipped / inputs / checked / 降格理由）
// だけを話す。JSON・正準直列化・スキーマ適合検証は**形式の知識**であり
// アダプタ層の責務（オーナー裁定 2026-08-30：Json はユビキタス言語ではない）。
//
// 検査の書き込み側は本集約ルートが所有する（種別規律の裁定 14、2026-09-02）。
// `open` が検査ファミリー面で空の文書を開き、`finding`／`skip`／`input` は
// レポートのコマンド（void）。「checked = 全 family − failed − skipped」の
// 導出と正準順（inputs は artifact 順・checked は一意化＋id 順・findings と
// skipped はカタログ順）はレポートの不変条件——どのコマンドの後でも成立する。
// 描画（finding detail の `${family}: ${detail}`、checked／skip target の
// `check:${family}`）は CheckFamily の知識で、golden バイト凍結。unit は
// functional センサーのみが持つ（finding／skip のキー順の末尾、凍結）。
//
// 入口は 3 つ：
//   - open         … 検査ファミリーで空の文書を開く（検査はコマンドで書き込む）
//   - degraded     … 契約不適合と判定された文書の降格形（理由文言は emitter＝
//                    アダプタが組んで渡す。inputs は保持、内容は空になる——凍結挙動）
//   - reconstitute … 書かれた真実（アダプタが型付きに解いた状態）からの再構成

import { FrRefs, TargetId, TargetIds } from "../../kernel/domain/index.ts";
import type { CheckFamilies } from "./check-families.ts";
import type { CheckFamily } from "./check-family.ts";
import { Finding } from "./finding.ts";
import { Findings } from "./findings.ts";
import type { InputAnchor } from "./input-anchor.ts";
import { InputAnchors } from "./input-anchors.ts";
import { ReferenceCheckReportId } from "./reference-check-report-id.ts";
import { Skipped } from "./skipped.ts";
import { Skips } from "./skips.ts";
import type { UnitName } from "../../kernel/domain/index.ts";
import type { WitnessRef } from "./witness-ref.ts";
import { WitnessRefs } from "./witness-refs.ts";


export class ReferenceCheckReport {
  readonly #id: ReferenceCheckReportId;
  #inputs: InputAnchors;
  #checked: TargetIds;
  #findings: Findings;
  #skipped: Skips;
  readonly #unavailableReason: string | null;
  readonly #unit: UnitName | undefined;

  private constructor(
    id: ReferenceCheckReportId,
    inputs: InputAnchors,
    checked: TargetIds,
    findings: Findings,
    skipped: Skips,
    unavailableReason: string | null,
    unit: UnitName | undefined,
  ) {
    this.#id = id;
    this.#inputs = inputs;
    this.#checked = checked;
    this.#findings = findings;
    this.#skipped = skipped;
    this.#unavailableReason = unavailableReason;
    this.#unit = unit;
  }

  // 検査ファミリーで空の文書を開く。開いた時点では全 family が checked で、
  // finding／skip がその family を checked から外していく（不変条件）。
  static open(id: ReferenceCheckReportId, families: CheckFamilies, unit?: UnitName): ReferenceCheckReport {
    return new ReferenceCheckReport(
      id,
      InputAnchors.of([]),
      families.checkTargets().sortedUniqueCanonically(),
      Findings.of([]),
      Skips.of([]),
      null,
      unit,
    );
  }

  // 契約不適合時の降格形。inputs は保持し内容を空にする（凍結挙動）。
  // 理由文言は emitter（アダプタ）が組んで渡す——ドメインは値として保持する。
  degraded(reason: string): ReferenceCheckReport {
    return new ReferenceCheckReport(this.#id, this.#inputs, TargetIds.of([]), Findings.of([]), Skips.of([]), reason, undefined);
  }

  // 書かれた真実からの再構成（Repository の読出側だけが使う）。書込時に
  // 契約適合が保証されているため、並びも含め「書かれたまま」を保持する。
  static reconstitute(seed: {
    readonly id: ReferenceCheckReportId;
    readonly inputs: InputAnchors;
    readonly checked: TargetIds;
    readonly findings: Findings;
    readonly skipped: Skips;
    } & { readonly unavailableReason: string | null }): ReferenceCheckReport {
      return new ReferenceCheckReport(
        seed.id,
        seed.inputs,
        seed.checked,
        seed.findings,
        seed.skipped,
        seed.unavailableReason,
        undefined,
      );
    }

    // family の finding を記録する。detail は family prefix 付きで描画され、
    // その family は checked から外れる。findings はカタログ順を保つ。
    finding(family: CheckFamily, kind: string, targets: string[], refs: WitnessRef[], detail: string, frRefs: string[] = []): void {
      this.#findings = this.#findings.add(Finding.reconstitute({
        kind,
        frRefs: FrRefs.reconstitute(frRefs).sortedUnique(),
        targets: TargetIds.reconstitute(targets).sortedUniqueCanonically(),
        witness: { refs: WitnessRefs.of(refs) },
        detail: family.prefixedDetail(detail),
        ...(this.#unit !== undefined ? { unit: this.#unit.asString() } : {}),
      })).sortedCanonically();
      this.#checked = this.#checked.excluding(TargetId.reconstitute(family.asCheckTarget()));
    }

    // family の skip を記録する。その family は checked から外れる。
    // skipped は target → reason の正準順を保つ。
    skip(family: CheckFamily, reason: string, detail: string): void {
      this.#skipped = this.#skipped.add(Skipped.reconstitute({
        target: family.asCheckTarget(),
        reason,
        detail,
        ...(this.#unit !== undefined ? { unit: this.#unit.asString() } : {}),
      })).sortedCanonically();
      this.#checked = this.#checked.excluding(TargetId.reconstitute(family.asCheckTarget()));
    }

    // 検査が読んだ文書をアンカーとして記録する。inputs は artifact 順を保つ
    // （irHash の材料になる凍結正準形）。
    input(anchor: InputAnchor): void {
      this.#inputs = this.#inputs.add(anchor).sortedByArtifact();
    }

    id(): ReferenceCheckReportId {
      return this.#id;
    }

    inputs(): InputAnchors {
      return this.#inputs;
    }

    checked(): TargetIds {
      return this.#checked;
    }

    findings(): Findings {
      return this.#findings;
    }

    skipped(): Skips {
      return this.#skipped;
    }

    unavailableReason(): string | null {
      return this.#unavailableReason;
    }

    isUnavailable(): boolean {
      return this.#unavailableReason !== null;
    }

    findingsCount(): number {
      return this.#findings.count();
    }

    skippedCount(): number {
      return this.#skipped.count();
    }

    // センサー verdict の述語：降格しておらず finding が 0 なら pass。
    passes(): boolean {
      return this.#unavailableReason === null && this.#findings.isEmpty();
    }
  }
