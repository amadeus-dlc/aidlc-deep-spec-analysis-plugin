// DesignModel 集約 — 検証済み設計の形式モデル（契約3）のドメイン表現。
// ユニットのユニット名昇順は集約の不変条件として compose が一度だけ適用する
// （旧 parseDesignIr 末尾のソートの移設）。

import type { ContentHash, IntermediateRepresentationVersion, VerificationMethod } from "@deep-spec/kernel-domain";
import { err, ok, type Result } from "@deep-spec/kernel-infrastructure";
import type { DesignModelIdentifier } from "./design-model-identifier.ts";
import { DesignReport, SUPPORTED_DESIGN_IR_MAJOR } from "./design-report.ts";
import type { DesignReportIdentifier } from "./design-report-identifier.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { DesignUnits } from "./design-units.ts";

export class DesignModel {
  readonly #id: DesignModelIdentifier;
  readonly #irHash: ContentHash;
  readonly #sourceDocument: Uint8Array;
  readonly #irVersion: IntermediateRepresentationVersion;
  readonly #units: DesignUnits;

  private constructor(
    input: {
      readonly id: DesignModelIdentifier;
      // 生 IR の正準 JSON の sha256（アダプタが導出——文書の同一性照合材料）。
      readonly irHash: ContentHash;
      // 成果物の原文の生バイト列（原文材料——store の往復則 findById∘store がバイト恒等）。
      readonly sourceDocument: Uint8Array;
      readonly irVersion: IntermediateRepresentationVersion;
      readonly units: DesignUnits;
    },
    units: DesignUnits,
  ) {
    this.#id = input.id;
    this.#irHash = input.irHash;
    this.#sourceDocument = new Uint8Array(input.sourceDocument);
    this.#irVersion = input.irVersion;
    this.#units = units;
  }

  // ユニット名昇順を不変条件としてここで一度だけ適用する。
  static compose(input: {
    readonly id: DesignModelIdentifier;
    // 生 IR の正準 JSON の sha256（アダプタが導出——文書の同一性照合材料）。
    readonly irHash: ContentHash;
    // 成果物の原文の生バイト列（原文材料——store の往復則 findById∘store がバイト恒等）。
    readonly sourceDocument: Uint8Array;
    readonly irVersion: IntermediateRepresentationVersion;
    readonly units: DesignUnits;
  }): DesignModel {
    return new DesignModel(input, input.units.sortedByName());
  }

  id(): DesignModelIdentifier {
    return this.#id;
  }

  // 境界: 兄弟文書・map の hash と照合される同一性材料。
  irHash(): ContentHash {
    return this.#irHash;
  }

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }

  irVersion(): IntermediateRepresentationVersion {
    return this.#irVersion;
  }

  // 境界: 旧実装の major 抽出と同じ計算（skip detail 文言に載る）。
  majorVersion(): number {
    return this.#irVersion.majorVersion();
  }

  supportsMajor(major: number): boolean {
    return this.#irVersion.supportsMajor(major);
  }

  units(): DesignUnits {
    return this.#units;
  }

  *[Symbol.iterator](): Iterator<DesignUnit> {
    yield* this.#units;
  }

  prepareVerification(id: DesignReportIdentifier, method: VerificationMethod): Result<DesignModel, DesignReport> {
    return this.#irVersion.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)
      ? ok(this)
      : err(DesignReport.versionMismatch(id, this, this.#irHash, method.asString()));
  }
}
