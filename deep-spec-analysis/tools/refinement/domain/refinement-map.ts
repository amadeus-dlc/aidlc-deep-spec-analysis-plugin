// RefinementMap（契約4）— 人間が承認した抽象化関数 alpha の宣言。
// AttributeMapping は閉じたユニオン：式写像（bool/int）か enum の場合分け
// （オーナー裁定 7 — expr/enumMap の Option 対を型で畳む）。"unspecified" は
// 契約4 スキーマ検証を通った文書では到達しない素通し形（旧実装は expr も
// enumMap も無い entry を byReq へ登録だけしていた——挙動保存のため表現を残す。
// alpha 到達時は AlphaError）。ユニットの帰属は DesignUnitId（集約 ID）で運び、
// 集まりはファーストクラスコレクションで運ぶ。

import { DesignUnitId } from "../../design/domain/index.ts";
import { IdOrder } from "../../kernel/domain/index.ts";
import type { RefinementMapId } from "./refinement-map-id.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";

export type AttributeMapping =
  | { readonly kind: "expression"; readonly req: string; readonly expr: Expression }
  | { readonly kind: "enum-cases"; readonly req: string; readonly from: string; readonly cases: { readonly [designValue: string]: string } }
  | { readonly kind: "unspecified"; readonly req: string };

// attrMap 宣言のファーストクラスコレクション（宣言順を保持——重複検出の
// gap 発火順は plan が宣言順に歩くことで凍結される）。
export class AttributeMappings {
  readonly #values: readonly AttributeMapping[];

  private constructor(values: readonly AttributeMapping[]) {
    this.#values = values;
  }

  static of(values: readonly AttributeMapping[]): AttributeMappings {
    return new AttributeMappings([...values]);
  }

  add(value: AttributeMapping): AttributeMappings {
    return new AttributeMappings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeMapping> {
    yield* this.#values;
  }

  toArray(): readonly AttributeMapping[] {
    return this.#values;
  }
}

// eventMap の transitions（写像先の設計 遷移/義務 id）のコレクション。
export class TransitionRefs {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): TransitionRefs {
    return new TransitionRefs([...values]);
  }

  add(value: string): TransitionRefs {
    return new TransitionRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  // 宣言に無い設計 id（gap 文言用の辞書順——旧 .sort() の凍結挙動）。
  unknownAmong(declared: ReadonlySet<string>): string[] {
    return this.#values.filter((t) => !declared.has(t)).sort();
  }

  // eventTransitions 索引が持つ正準順（IdOrder.compare）。
  sortedCanonically(): string[] {
    return [...this.#values].sort(IdOrder.compare);
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

export interface EventMapping {
  readonly reqTrigger: string;
  readonly transitions: TransitionRefs;
  readonly waived?: { readonly reason: string };
}

// eventMap 宣言のファーストクラスコレクション。トリガ索引は旧
// new Map(...) の凍結挙動どおり重複トリガは最後の宣言が勝つ。
export class EventMappings {
  readonly #values: readonly EventMapping[];

  private constructor(values: readonly EventMapping[]) {
    this.#values = values;
  }

  static of(values: readonly EventMapping[]): EventMappings {
    return new EventMappings([...values]);
  }

  add(value: EventMapping): EventMappings {
    return new EventMappings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EventMapping> {
    yield* this.#values;
  }

  ofTrigger(reqTrigger: string): EventMapping | undefined {
    let found: EventMapping | undefined;
    for (const e of this.#values) {
      if (e.reqTrigger === reqTrigger) found = e;
    }
    return found;
  }

  toArray(): readonly EventMapping[] {
    return this.#values;
  }
}

export interface UnmappedTarget {
  readonly target: string;
  readonly reason: string;
}

// unmapped[]（写像しないことの明示宣言＝waiver）のコレクション。理由の索引は
// 旧 new Map(...) の凍結挙動どおり重複 target は最後の宣言が勝つ。
export class UnmappedDeclarations {
  readonly #values: readonly UnmappedTarget[];

  private constructor(values: readonly UnmappedTarget[]) {
    this.#values = values;
  }

  static of(values: readonly UnmappedTarget[]): UnmappedDeclarations {
    return new UnmappedDeclarations([...values]);
  }

  add(value: UnmappedTarget): UnmappedDeclarations {
    return new UnmappedDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnmappedTarget> {
    yield* this.#values;
  }

  covers(target: string): boolean {
    return this.#values.some((x) => x.target === target);
  }

  coversAll(targets: readonly string[]): boolean {
    return targets.every((t) => this.covers(t));
  }

  reasonOf(target: string): string | undefined {
    let found: string | undefined;
    for (const x of this.#values) {
      if (x.target === target) found = x.reason;
    }
    return found;
  }

  toArray(): readonly UnmappedTarget[] {
    return this.#values;
  }
}

export interface RefinementUnitMap {
  readonly unit: DesignUnitId;
  readonly attrMap: AttributeMappings;
  readonly eventMap: EventMappings;
  readonly unmapped: UnmappedDeclarations;
}

// ユニット写像のファーストクラスコレクション。重複ユニットは最初の宣言が
// 勝つ（旧 find の凍結挙動）。
export class RefinementUnitMaps {
  readonly #values: readonly RefinementUnitMap[];

  private constructor(values: readonly RefinementUnitMap[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementUnitMap[]): RefinementUnitMaps {
    return new RefinementUnitMaps([...values]);
  }

  add(value: RefinementUnitMap): RefinementUnitMaps {
    return new RefinementUnitMaps([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementUnitMap> {
    yield* this.#values;
  }

  mapOf(unit: DesignUnitId): RefinementUnitMap | undefined {
    return this.#values.find((m) => m.unit.equals(unit));
  }

  toArray(): readonly RefinementUnitMap[] {
    return this.#values;
  }
}

export interface RefinementMapSeed {
  readonly id: RefinementMapId;
  readonly requirementsIrHash: ContentHash;
  readonly designIrHash: ContentHash;
  readonly units: RefinementUnitMaps;
}

export class RefinementMap {
  readonly #id: RefinementMapId;
  readonly #requirementsIrHash: ContentHash;
  readonly #designIrHash: ContentHash;
  readonly #units: RefinementUnitMaps;

  private constructor(seed: RefinementMapSeed) {
    this.#id = seed.id;
    this.#requirementsIrHash = seed.requirementsIrHash;
    this.#designIrHash = seed.designIrHash;
    this.#units = seed.units;
  }

  // アダプタのパーサ（契約4 スキーマ検証済み）からの唯一の構築口。
  static reconstitute(seed: RefinementMapSeed): RefinementMap {
    return new RefinementMap(seed);
  }

  // 境界: 要件形式モデルの hash と照合される宣言値（陳腐化検出）。
  id(): RefinementMapId {
    return this.#id;
  }

  requirementsIrHash(): ContentHash {
    return this.#requirementsIrHash;
  }

  // 境界: 設計 IR の irHash と照合される宣言値（陳腐化検出）。
  designIrHash(): ContentHash {
    return this.#designIrHash;
  }

  units(): RefinementUnitMaps {
    return this.#units;
  }

  unitMapOf(unit: DesignUnitId): RefinementUnitMap | undefined {
    return this.#units.mapOf(unit);
  }
}
