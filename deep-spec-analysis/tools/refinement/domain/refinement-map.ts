// RefinementMap（契約4）— 人間が承認した抽象化関数 alpha の宣言。
// AttributeMapping は閉じたユニオン：式写像（bool/int）か enum の場合分け
// （オーナー裁定 7 — expr/enumMap の Option 対を型で畳む）。"unspecified" は
// 契約4 スキーマ検証を通った文書では到達しない素通し形（旧実装は expr も
// enumMap も無い entry を byReq へ登録だけしていた——挙動保存のため表現を残す。
// alpha 到達時は AlphaError）。ユニットの帰属は DesignUnitId（集約 ID）で運び、
// 集まりはファーストクラスコレクションで運ぶ。

import { DesignUnitId } from "../../design/domain/index.ts";
import type { AttributePath } from "../../requirements/domain/index.ts";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { IdOrder } from "../../kernel/domain/index.ts";
import type { RefinementMapId } from "./refinement-map-id.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";

export type AttributeMapping =
  | { readonly kind: "expression"; readonly req: AttributePath; readonly expr: Expression }
  | { readonly kind: "enum-cases"; readonly req: AttributePath; readonly from: string; readonly cases: { readonly [designValue: string]: string } }
  | { readonly kind: "unspecified"; readonly req: AttributePath };

export type RefinementMapTokenError = { readonly kind: "empty-refinement-map-token"; readonly raw: string };

// eventMap.transitions の要素——写像先の設計 遷移/義務 id への宣言参照。
export class TransitionRef {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<TransitionRef, RefinementMapTokenError> {
    if (raw === "") return err({ kind: "empty-refinement-map-token", raw });
    return ok(new TransitionRef(raw));
  }

  static reconstitute(raw: string): TransitionRef {
    return new TransitionRef(raw);
  }

  equals(other: TransitionRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

// unmapped[].target の宣言トークン——要件属性パス・義務 id・シナリオ id の
// どれをも指しうる契約4 の waiver 語彙。
export class UnmappedTargetRef {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<UnmappedTargetRef, RefinementMapTokenError> {
    if (raw === "") return err({ kind: "empty-refinement-map-token", raw });
    return ok(new UnmappedTargetRef(raw));
  }

  static reconstitute(raw: string): UnmappedTargetRef {
    return new UnmappedTargetRef(raw);
  }

  equals(other: UnmappedTargetRef): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

// 照合トークンの運び手——DP はそのまま渡し、生パス（Expression 由来）は
// string のまま渡す。照合はコレクション自身の知識（Tell-Don't-Ask 裁定）。
export type RefTokenCarrier = string | { asString(): string };

function tokenOf(carrier: RefTokenCarrier): string {
  return typeof carrier === "string" ? carrier : carrier.asString();
}

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
  readonly #values: readonly TransitionRef[];

  private constructor(values: readonly TransitionRef[]) {
    this.#values = values;
  }

  static of(values: readonly TransitionRef[]): TransitionRefs {
    return new TransitionRefs([...values]);
  }

  add(value: TransitionRef): TransitionRefs {
    return new TransitionRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<TransitionRef> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  // 宣言に無い設計 id（gap 文言用の辞書順——旧 .sort() の凍結挙動）。
  unknownAmong(declared: ReadonlySet<string>): string[] {
    return this.#values.map((t) => t.asString()).filter((t) => !declared.has(t)).sort();
  }

  // eventTransitions 索引が持つ正準順（IdOrder.compare）。
  sortedCanonically(): readonly TransitionRef[] {
    return [...this.#values].sort((a, b) => IdOrder.compare(a.asString(), b.asString()));
  }

  toArray(): readonly TransitionRef[] {
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
  readonly target: UnmappedTargetRef;
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

  covers(target: RefTokenCarrier): boolean {
    const t = tokenOf(target);
    return this.#values.some((x) => x.target.asString() === t);
  }

  coversAll(targets: readonly RefTokenCarrier[]): boolean {
    return targets.every((t) => this.covers(t));
  }

  reasonOf(target: RefTokenCarrier): string | undefined {
    const t = tokenOf(target);
    let found: string | undefined;
    for (const x of this.#values) {
      if (x.target.asString() === t) found = x.reason;
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
  // 成果物の原文（原文材料——store の往復則 findById∘store がバイト恒等）。
  readonly sourceDocument: Uint8Array;
}

export class RefinementMap {
  readonly #id: RefinementMapId;
  readonly #requirementsIrHash: ContentHash;
  readonly #designIrHash: ContentHash;
  readonly #units: RefinementUnitMaps;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: RefinementMapSeed) {
    this.#id = seed.id;
    this.#requirementsIrHash = seed.requirementsIrHash;
    this.#designIrHash = seed.designIrHash;
    this.#units = seed.units;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
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

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
