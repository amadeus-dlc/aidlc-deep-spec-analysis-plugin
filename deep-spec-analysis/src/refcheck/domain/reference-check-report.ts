import {
  ContentHash,
  type FindingKind,
  type FindingsSchema,
  type FindingTargets,
  FunctionalRequirementReferences,
  RequirementIdentifier,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";

// ReferenceCheckReport 集約 — 契約2 の refcheck 文書のドメイン表現。
//
// 型付きのfindings・skipped・inputs・checked・降格理由を保持する。
// toDocument()が文書形とキー順を所有し、アダプタはJSONと改行へ描画する。
// conformedTo(FindingsSchema)が契約適合を判定し、降格理由はFindingsSchemaが所有する。
//
// 検査の書き込み側は本集約ルートが所有する。
// `open` が検査ファミリー面で空の文書を開き、`finding`／`skip`／`input` は
// レポートのコマンド（void）。「checked = 全 family − failed − skipped」の
// 導出と正準順（inputs は artifact 順・checked は一意化＋id 順・findings と
// skipped はカタログ順）はレポートの不変条件——どのコマンドの後でも成立する。
// 描画（finding detail の `${family}: ${detail}`、checked／skip target の
// `check:${family}`）は CheckFamily の知識で、golden バイト凍結。unit は
// functional センサーのみが持つ（finding／skip のキー順の末尾、凍結）。

import { canonicalStringify, type Json } from "@deep-spec-analysis/kernel-infrastructure";
import { CATALOG_VERSION } from "./catalog-version.ts";
import type { CheckFamilies } from "./check-families.ts";
import type { CheckFamily } from "./check-family.ts";
import { Finding } from "./finding.ts";
import { Findings } from "./findings.ts";
import type { InputAnchor } from "./input-anchor.ts";
import { InputAnchors } from "./input-anchors.ts";
import type { ReferenceCheckReportIdentifier } from "./reference-check-report-identifier.ts";
import { Skipped } from "./skipped.ts";
import { Skips } from "./skips.ts";

import type { WitnessReference } from "./witness-reference.ts";
import { WitnessReferences } from "./witness-references.ts";

export class ReferenceCheckReport {
  readonly #id: ReferenceCheckReportIdentifier;
  #inputs: InputAnchors;
  #checked: TargetIdentifiers;
  #findings: Findings;
  #skipped: Skips;
  readonly #unavailableReason: string | null;
  readonly #unit: UnitName | undefined;

  private constructor(
    id: ReferenceCheckReportIdentifier,
    inputs: InputAnchors,
    checked: TargetIdentifiers,
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
  static open(id: ReferenceCheckReportIdentifier, families: CheckFamilies, unit?: UnitName): ReferenceCheckReport {
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

  // 契約不適合時はinputsを保持し、検査結果を空にする。
  // conformedToがFindingsSchemaから受け取った降格理由を保持する。
  degraded(reason: string): ReferenceCheckReport {
    return new ReferenceCheckReport(
      this.#id,
      this.#inputs,
      TargetIdentifiers.of([]),
      Findings.of([]),
      Skips.of([]),
      reason,
      undefined,
    );
  }

  // 書かれた真実からの再構成（Repository の読出側だけが使う）。書込時に
  // 契約適合が保証されているため、並びも含め「書かれたまま」を保持する。
  static of(
    seed: {
      readonly id: ReferenceCheckReportIdentifier;
      readonly inputs: InputAnchors;
      readonly checked: TargetIdentifiers;
      readonly findings: Findings;
      readonly skipped: Skips;
    } & { readonly unavailableReason: string | null },
  ): ReferenceCheckReport {
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
  finding(
    family: CheckFamily,
    kind: FindingKind,
    targets: FindingTargets,
    refs: WitnessReference[],
    detail: string,
    functionalRequirementReferences: string[] = [],
  ): void {
    this.#findings = this.#findings
      .add(
        Finding.of({
          kind,
          functionalRequirementReferences: FunctionalRequirementReferences.of(
            Array.from(functionalRequirementReferences, (raw) => RequirementIdentifier.of(raw)),
          ).sortedUnique(),
          targets: targets.sortedUniqueCanonically(),
          witness: { refs: WitnessReferences.of(refs) },
          detail: family.prefixedDetail(detail),
          ...(this.#unit !== undefined ? { unit: this.#unit } : {}),
        }),
      )
      .sortedCanonically();
    this.#checked = this.#checked.excluding(TargetIdentifier.of(family.asCheckTarget()));
  }

  // family の skip を記録する。その family は checked から外れる。
  // skipped は target → reason の正準順を保つ。
  skip(family: CheckFamily, reason: string, detail: string): void {
    this.#skipped = this.#skipped
      .add(
        Skipped.of({
          target: TargetIdentifier.of(family.asCheckTarget()),
          reason: SkipReason.of(reason),
          detail,
          ...(this.#unit !== undefined ? { unit: this.#unit } : {}),
        }),
      )
      .sortedCanonically();
    this.#checked = this.#checked.excluding(TargetIdentifier.of(family.asCheckTarget()));
  }

  // 検査が読んだ文書をアンカーとして記録する。inputs は artifact 順を保つ
  // （irHash の材料になる凍結正準形）。
  input(anchor: InputAnchor): void {
    this.#inputs = this.#inputs.add(anchor).sortedByArtifact();
  }

  id(): ReferenceCheckReportIdentifier {
    return this.#id;
  }

  inputs(): InputAnchors {
    return this.#inputs;
  }

  checked(): TargetIdentifiers {
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
    const inputs = this.#inputs.toDocuments() as unknown as Json;
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
    // ペイロードの 1 行ずつのキー順（golden バイト凍結）は記録自身が所有する：
    // finding は (kind, frRefs, targets, witness, detail, unit?)、witness ref は
    // (artifact, element, value?)、skip は (target, reason, detail?, unit?)。
    ordered.findings = this.#findings.toDocuments();
    ordered.skipped = this.#skipped.toDocuments();
    return ordered;
  }

  // 契約2 への適合を保証した集約を返す。適合していれば自分自身、していなければ
  // 降格形（文言は FindingsSchema が凍結で所有する）。
  conformedTo(schema: FindingsSchema): ReferenceCheckReport {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}
