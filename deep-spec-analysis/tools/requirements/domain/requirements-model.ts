// RequirementsModel 集約 — 検証済み要件の形式モデル（契約1）のドメイン表現。
// 生 Json からの寛容な解体（欠損エントリの黙殺）はアダプタのパーサの責務で、
// ここは型付き部品を組む。クエリ（allTargets / frRefsOf / attributeAt /
// supportsMajor）は旧センサーの自由関数群を集約メソッドへ移したもの。
// 配列を生で運ばない：部品はファーストクラスコレクションで受け取り・返す。

import { type IrVersion, FrRefs, IdOrder, TargetIds } from "../../kernel/domain/index.ts";
import { type AttributeDeclaration } from "./attribute-declaration.ts";
import { AttributeDeclarations } from "./attribute-declarations.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import type { FormalModelId } from "./formal-model-id.ts";
import { Obligations } from "./obligations.ts";
import { Scenarios } from "./scenarios.ts";
import { BackgroundAssumptions } from "./background-assumptions.ts";






export class RequirementsModel {
  readonly #id: FormalModelId;
  readonly #irHash: ContentHash;
  readonly #sourceDocument: Uint8Array;
  readonly #irVersion: IrVersion;
  readonly #attributes: AttributeDeclarations;
  readonly #obligations: Obligations;
  readonly #scenarios: Scenarios;
  readonly #background: BackgroundAssumptions;

  private constructor(seed: {
    readonly id: FormalModelId;
    // 生 IR の正準 JSON の sha256（アダプタが導出——文書の同一性照合材料）。
    readonly irHash: ContentHash;
    // 成果物の原文の生バイト列（原文材料——store の往復則 findById∘store がバイト恒等）。
    readonly sourceDocument: Uint8Array;
    readonly irVersion: IrVersion;
    readonly attributes: AttributeDeclarations;
    readonly obligations: Obligations;
    readonly scenarios: Scenarios;
    readonly background: BackgroundAssumptions;
  }) {
    this.#id = seed.id;
    this.#irHash = seed.irHash;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
    this.#irVersion = seed.irVersion;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタのパーサが解いた型付き部品からの唯一の構築口。
  static reconstitute(seed: {
    readonly id: FormalModelId;
    // 生 IR の正準 JSON の sha256（アダプタが導出——文書の同一性照合材料）。
    readonly irHash: ContentHash;
    // 成果物の原文の生バイト列（原文材料——store の往復則 findById∘store がバイト恒等）。
    readonly sourceDocument: Uint8Array;
    readonly irVersion: IrVersion;
    readonly attributes: AttributeDeclarations;
    readonly obligations: Obligations;
    readonly scenarios: Scenarios;
    readonly background: BackgroundAssumptions;
  }): RequirementsModel {
    return new RequirementsModel(seed);
  }

  id(): FormalModelId {
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

  irVersion(): IrVersion {
    return this.#irVersion;
  }

  supportsMajor(major: number): boolean {
    return this.#irVersion.supportsMajor(major);
  }

  // 境界: 旧実装の major 抽出と同じ計算（verdict 文言に載る）。
  majorVersion(): number {
    return this.#irVersion.majorVersion();
  }

  attributes(): AttributeDeclarations {
    return this.#attributes;
  }

  attributeAt(path: string): AttributeDeclaration | undefined {
    return this.#attributes.byPath(path);
  }

  obligations(): Obligations {
    return this.#obligations;
  }

  scenarios(): Scenarios {
    return this.#scenarios;
  }

  background(): BackgroundAssumptions {
    return this.#background;
  }

  // 境界: 縮退文書の skip 対象列（義務 id ＋シナリオ id の昇順——凍結順）。
  allTargets(): TargetIds {
    return TargetIds.reconstitute([...this.#obligations.ids(), ...this.#scenarios.ids()].sort(IdOrder.compare));
  }

  // 対象 id 列が指す義務・シナリオの FR 参照（一意・正準順）。
  frRefsOf(targets: TargetIds): FrRefs {
    const refs: string[] = [];
    for (const t of targets) {
      const ob = this.#obligations.byId(t.asString());
      if (ob) refs.push(...ob.frRefs());
      const sc = this.#scenarios.byId(t.asString());
      if (sc) refs.push(...sc.frRefs());
    }
    return FrRefs.of(IdOrder.sortedUnique(refs, IdOrder.compare));
  }
}
