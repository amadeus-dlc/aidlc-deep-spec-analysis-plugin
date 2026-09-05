import {
  SkipReason,
  RequirementId,
  ContentHash,
  FindingKind,
  FrRefs,
  TargetId,
  TargetIds,
  type FindingsSchema,
  type UnitName,
} from "@deep-spec/kernel-domain";

// ReferenceCheckReport 集約 — 契約2 の refcheck 文書のドメイン表現。
//
// ドメインは型付きの語彙（findings / skipped / inputs / checked / 降格理由）
// だけを話す。JSON への描画点は `toDocument()`（契約2 のキー順を所有）に
// 封じ、アダプタは `JSON.stringify` で描画するだけ（design 集約と同じ分担、
// PR2b 改訂）。契約適合の判定も `conformedTo(FindingsSchema)` としてここに
// 持つ——文言は値オブジェクト FindingsSchema が凍結で所有する。
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
//   - of … 書かれた真実（アダプタが型付きに解いた状態）からの再構成

import { type Json, canonicalStringify } from "@deep-spec/kernel-infrastructure";
import { CATALOG_VERSION } from "./catalog-version.ts";
import type { CheckFamilies } from "./check-families.ts";
import type { CheckFamily } from "./check-family.ts";
import { Finding } from "./finding.ts";
import { Findings } from "./findings.ts";
import type { InputAnchor } from "./input-anchor.ts";
import { InputAnchors } from "./input-anchors.ts";
import { ReferenceCheckReportId } from "./reference-check-report-id.ts";
import { Skipped } from "./skipped.ts";
import { Skips } from "./skips.ts";

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
  static of(seed: {
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
    // kind は検証済みの FindingKind——検査が自ら下す判定は正常生成経路であり、
    // 任意の string を受け取らない（FR3.2）。復元時も同じ契約が成立する。
    finding(family: CheckFamily, kind: FindingKind, targets: string[], refs: WitnessRef[], detail: string, frRefs: string[] = []): void {
      this.#findings = this.#findings.add(Finding.of({
        kind,
        frRefs: FrRefs.of(Array.from(frRefs, (raw) => RequirementId.of(raw))).sortedUnique(),
        targets: TargetIds.of(Array.from(targets, (raw) => TargetId.of(raw))).sortedUniqueCanonically(),
        witness: { refs: WitnessRefs.of(refs) },
        detail: family.prefixedDetail(detail),
        ...(this.#unit !== undefined ? { unit: this.#unit} : {}),
      })).sortedCanonically();
      this.#checked = this.#checked.excluding(TargetId.of(family.asCheckTarget()));
    }

    // family の skip を記録する。その family は checked から外れる。
    // skipped は target → reason の正準順を保つ。
    skip(family: CheckFamily, reason: string, detail: string): void {
      this.#skipped = this.#skipped.add(Skipped.of({
        target: TargetId.of(family.asCheckTarget()),
        reason: SkipReason.of(reason),
        detail,
        ...(this.#unit !== undefined ? { unit: this.#unit} : {}),
      })).sortedCanonically();
      this.#checked = this.#checked.excluding(TargetId.of(family.asCheckTarget()));
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

    // 契約2 の文書像。キー順（backend, irVersion, irHash, method, [unavailable],
    // inputs, checked, findings, skipped）は契約の知識なので集約が所有する——
    // アダプタは JSON.stringify で描画するだけ（旧 serializer の orderedDocument
    // を逐語で移設、golden 凍結）。irHash は inputs の正準 JSON の sha256。
    toDocument(): { [k: string]: Json } {
      const inputs = this.#inputs.toArray().map((i) => ({ artifact: i.artifact(), sha256: i.sha256().asString() })) as unknown as Json;
      const ordered: { [k: string]: Json } = {
        backend: this.#id.backendName().asString(),
        irVersion: CATALOG_VERSION,
        irHash: ContentHash.ofText(canonicalStringify(inputs)).asString(),
        method: "static",
      };
      const reason = this.#unavailableReason;
      if (reason !== null) ordered.unavailable = { reason };
      ordered.inputs = inputs;
      ordered.checked = this.#checked.toStrings() as unknown as Json;
      // ペイロードのコレクションはこの描画点でだけ toArray() に降りる。キー順は
      // 旧構築サイトの挿入順そのもの（golden バイト凍結）：finding は (kind,
      // frRefs, targets, witness, detail, unit?)、witness ref は (artifact,
      // element, value?)、skip は (target, reason, detail?, unit?)。
      ordered.findings = this.#findings.toArray().map((f) => {
        const refs = f.witnessRefs().toArray().map((r) => {
          const out: { [k: string]: Json } = { artifact: r.artifact(), element: r.element() };
          const value = r.value();
          if (value !== undefined) out.value = value;
          return out as Json;
        });
        const out: { [k: string]: Json } = {
          kind: f.kind(),
          frRefs: f.frRefs().toStrings() as unknown as Json,
          targets: f.targets().toStrings() as unknown as Json,
          witness: { refs },
          detail: f.detail(),
        };
        const unit = f.unit();
        if (unit !== undefined) out.unit = unit;
        return out as Json;
      });
      ordered.skipped = this.#skipped.toArray().map((sk) => {
        const out: { [k: string]: Json } = { target: sk.target(), reason: sk.reason() };
        const detail = sk.detail();
        if (detail !== undefined) out.detail = detail;
        const unit = sk.unit();
        if (unit !== undefined) out.unit = unit;
        return out as Json;
      });
      return ordered;
    }

    // 契約2 への適合を保証した集約を返す。適合していれば自分自身、していなければ
    // 降格形（文言は FindingsSchema が凍結で所有する）。
    conformedTo(schema: FindingsSchema): ReferenceCheckReport {
      const reason = schema.degradationReasonFor(this.toDocument());
      return reason === null ? this : this.degraded(reason);
    }
  }
