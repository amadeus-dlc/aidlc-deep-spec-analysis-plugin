// functional-design（entities.md / rules.md / functional-spec.md）と
// 横断検査（XS）向け domain-design エンティティのドメインオブジェクト。
// 解析（fence/YAML/mermaid/Json 歩き）はアダプタのパーサが行い、ここは
// 宣言が自分の整合性判定（型区分の衝突・範囲逆転・参照解決・被覆差分）を
// 所有する抽象データ型——検査ランナーは尋ねず（ask）、告げる（tell）だけ。
// 配列を生で運ばない：集合の知識（重複・差分・解決・選定）はファースト
// クラスコレクションが所有し、toArray() は境界（描画・アダプタ）専用の
// 脱出口。判定の意味論と文言の描画形は旧 functional-checks の凍結挙動の
// 逐語移設。

import { type RequirementIds } from "../../kernel/domain/index.ts";
import type {
  AllowedValues,
  AppliesTo,
  AttributeDefault,
  AttributeName,
  AttributeNames,
  BusinessRuleId,
  CardinalityNotation,
  ComponentName,
  ElementPath,
  EntityName,
  MachineSpec,
  NumericBound,
  ReferenceTarget,
  RuleCategory,
  SourceIds,
  StateNames,
  TypeName,
} from "./functional-design-values.ts";

// ---- entities.md ------------------------------------------------------------

export interface AttrDeclSeed {
  readonly name: AttributeName;
  readonly element: ElementPath;
  readonly type: TypeName | null;
  readonly uniqueIsTrue: boolean;
  readonly references: ReferenceTarget | null;
  readonly allowed: AllowedValues | null;
  readonly def: AttributeDefault | null;
  readonly minDeclared: boolean;
  readonly maxDeclared: boolean;
  readonly min: NumericBound | null;
  readonly max: NumericBound | null;
}

// 属性宣言。型区分との整合・範囲と既定値の整合・ライフサイクル候補性という
// ドメイン知識を自分で判定する（旧 FD-E2/E3 の条件式の移設）。
export class AttrDecl {
  readonly #seed: AttrDeclSeed;

  private constructor(seed: AttrDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: AttrDeclSeed): AttrDecl {
    return new AttrDecl(seed);
  }

  name(): AttributeName {
    return this.#seed.name;
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  references(): ReferenceTarget | null {
    return this.#seed.references;
  }

  def(): AttributeDefault | null {
    return this.#seed.def;
  }

  min(): NumericBound | null {
    return this.#seed.min;
  }

  max(): NumericBound | null {
    return this.#seed.max;
  }

  hasAllowedValues(): boolean {
    return this.#seed.allowed !== null;
  }

  // 境界: witness の location value に載る型トークン（未宣言は ""——凍結形）。
  typeToken(): string {
    return this.#seed.type === null ? "" : this.#seed.type.normalized();
  }

  // 境界: 文言に載る型の描画形（未宣言は旧 `${null}` の "null"——凍結形）。
  typeText(): string {
    return this.#seed.type === null ? "null" : this.#seed.type.value();
  }

  // FD-E2: 列挙できない型区分（数値・日付・真偽）に allowed_values を宣言。
  declaresAllowedValuesOnNonEnumerableType(): boolean {
    const t = this.#seed.type;
    if (t === null || this.#seed.allowed === null) return false;
    return t.classifiesNumeric() || t.classifiesDate() || t.classifiesBool();
  }

  // FD-E2: 数値・日付でない型に min/max を宣言（型未宣言は FD-E2 の対象外——凍結）。
  declaresBoundsOnNonNumericType(): boolean {
    const t = this.#seed.type;
    if (!(this.#seed.minDeclared || this.#seed.maxDeclared)) return false;
    if (t === null || t.normalized() === "") return false;
    return !t.classifiesNumeric() && !t.classifiesDate();
  }

  // FD-E2: コレクション型に unique を宣言。
  declaresUniqueOnCollectionType(): boolean {
    return this.#seed.uniqueIsTrue && this.#seed.type !== null && this.#seed.type.classifiesCollection();
  }

  // FD-E3: min > max の範囲逆転。
  boundsInverted(): boolean {
    return this.#seed.min !== null && this.#seed.max !== null && this.#seed.min.value() > this.#seed.max.value();
  }

  // FD-E3: 数値既定値が範囲の外。
  defaultBelowMin(): boolean {
    const d = this.#seed.def;
    return d !== null && d.isNumber() && this.#seed.min !== null && d.asNumber() < this.#seed.min.value();
  }

  defaultAboveMax(): boolean {
    const d = this.#seed.def;
    return d !== null && d.isNumber() && this.#seed.max !== null && d.asNumber() > this.#seed.max.value();
  }

  // FD-E3: 文字列既定値が allowed_values の外。
  defaultOutsideAllowed(): boolean {
    const d = this.#seed.def;
    if (this.#seed.allowed === null || d === null || !d.isString()) return false;
    return !this.#seed.allowed.containsValue(d.asString());
  }

  // ライフサイクル属性の候補性（status/state の名を帯び allowed を持つ）。
  bearsLifecycleName(): boolean {
    return this.#seed.name.value() === "status" || this.#seed.name.value() === "state";
  }

  // FD-S1: 図の状態のうち allowed values に無いもの（差分はコレクションが計算）。
  rogueDiagramStates(states: StateNames): string[] {
    return this.#seed.allowed === null ? [] : this.#seed.allowed.rogueAmong(states);
  }

  // FD-S2: allowed values のうちどの図状態にも現れないもの。
  allowedValuesAbsentFrom(states: StateNames): string[] {
    return this.#seed.allowed === null ? [] : this.#seed.allowed.absentFrom(states);
  }
}

// 属性宣言のコレクション。重複検出・ライフサイクル属性の選定・名前解決という
// 集合の知識を所有する。
export class AttrDecls {
  readonly #values: readonly AttrDecl[];

  private constructor(values: readonly AttrDecl[]) {
    this.#values = values;
  }

  static of(values: readonly AttrDecl[]): AttrDecls {
    return new AttrDecls([...values]);
  }

  add(value: AttrDecl): AttrDecls {
    return new AttrDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttrDecl> {
    yield* this.#values;
  }

  // 2 回目以降に現れた属性宣言（宣言順——旧 seen-set 走査と同じ列）。
  duplicatesByName(): AttrDecl[] {
    const seen = new Set<string>();
    const dups: AttrDecl[] = [];
    for (const a of this.#values) {
      if (seen.has(a.name().value())) dups.push(a);
      seen.add(a.name().value());
    }
    return dups;
  }

  // ライフサイクル属性：status/state の名で allowed を持つもの、無ければ
  // allowed を持つ唯一の属性、それも無ければ null（旧 lifecycleAttrOf）。
  lifecycleAttr(): AttrDecl | null {
    const named = this.#values.find((a) => a.bearsLifecycleName() && a.hasAllowedValues());
    if (named) return named;
    const withAllowed = this.#values.filter((a) => a.hasAllowedValues());
    return withAllowed.length === 1 ? (withAllowed[0] ?? null) : null;
  }

  named(token: string): AttrDecl | null {
    return this.#values.find((a) => a.name().value() === token) ?? null;
  }

  names(): AttributeName[] {
    return this.#values.map((a) => a.name());
  }

  toArray(): readonly AttrDecl[] {
    return this.#values;
  }
}

export interface RelDeclSeed {
  readonly element: ElementPath;
  readonly from: EntityName | null;
  readonly to: EntityName | null;
  readonly cardinality: CardinalityNotation | null;
  readonly hasDirection: boolean;
}

// 関係宣言。基数の閉集合整合と方向の宣言義務を自分で判定する（旧 FD-E5）。
export class RelDecl {
  readonly #seed: RelDeclSeed;

  private constructor(seed: RelDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: RelDeclSeed): RelDecl {
    return new RelDecl(seed);
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  from(): EntityName | null {
    return this.#seed.from;
  }

  to(): EntityName | null {
    return this.#seed.to;
  }

  cardinality(): CardinalityNotation | null {
    return this.#seed.cardinality;
  }

  cardinalityOutsideClosedSet(): boolean {
    return this.#seed.cardinality !== null && !this.#seed.cardinality.isInClosedSet();
  }

  cardinalityWithoutDirection(): boolean {
    return this.#seed.cardinality !== null && !this.#seed.hasDirection;
  }
}

export class RelDecls {
  readonly #values: readonly RelDecl[];

  private constructor(values: readonly RelDecl[]) {
    this.#values = values;
  }

  static of(values: readonly RelDecl[]): RelDecls {
    return new RelDecls([...values]);
  }

  add(value: RelDecl): RelDecls {
    return new RelDecls([...this.#values, value]);
  }

  concat(other: RelDecls): RelDecls {
    return new RelDecls([...this.#values, ...other.#values]);
  }

  *[Symbol.iterator](): Iterator<RelDecl> {
    yield* this.#values;
  }

  toArray(): readonly RelDecl[] {
    return this.#values;
  }
}

export interface EntityDeclSeed {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly attrs: AttrDecls;
  readonly rels: RelDecls;
}

// エンティティ宣言。属性の重複・選定・解決は属性コレクションに委ねる。
export class EntityDecl {
  readonly #seed: EntityDeclSeed;

  private constructor(seed: EntityDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: EntityDeclSeed): EntityDecl {
    return new EntityDecl(seed);
  }

  name(): EntityName {
    return this.#seed.name;
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  attrs(): AttrDecls {
    return this.#seed.attrs;
  }

  rels(): RelDecls {
    return this.#seed.rels;
  }

  lifecycleAttr(): AttrDecl | null {
    return this.#seed.attrs.lifecycleAttr();
  }

  attrNamed(token: string): AttrDecl | null {
    return this.#seed.attrs.named(token);
  }
}

// エンティティ宣言のコレクション。重複・所属・正規化名解決・ライフサイクル
// 対象の選定・あいまい照合という集合の知識を所有する。
export class EntityDecls {
  readonly #values: readonly EntityDecl[];
  readonly #names: Set<string>;

  private constructor(values: readonly EntityDecl[]) {
    this.#values = values;
    this.#names = new Set(values.map((e) => e.name().value()));
  }

  static of(values: readonly EntityDecl[]): EntityDecls {
    return new EntityDecls([...values]);
  }

  add(value: EntityDecl): EntityDecls {
    return new EntityDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EntityDecl> {
    yield* this.#values;
  }

  duplicatesByName(): EntityDecl[] {
    const seen = new Set<string>();
    const dups: EntityDecl[] = [];
    for (const e of this.#values) {
      if (seen.has(e.name().value())) dups.push(e);
      seen.add(e.name().value());
    }
    return dups;
  }

  containsNamed(value: string): boolean {
    return this.#names.has(value);
  }

  byNormalizedName(normalized: string): EntityDecl | undefined {
    return this.#values.find((e) => e.name().normalized() === normalized);
  }

  lifecycleOnly(): EntityDecl[] {
    return this.#values.filter((e) => e.lifecycleAttr() !== null);
  }

  // FD-E6: Entity / Entity.attr 形はエンティティ名の厳密照合、自由文は
  // 小文字包含の緩い照合（凍結挙動）。
  resolvesReference(reference: ReferenceTarget): boolean {
    const token = reference.value().match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.[A-Za-z][A-Za-z0-9_]*)?$/);
    if (token) return this.#names.has(token[1] ?? "");
    return this.#values.some((d) => reference.value().toLowerCase().includes(d.name().value().toLowerCase()));
  }

  // FD-R4: applies-to が Entity / Entity.attribute へ解決するか。
  resolvesAppliesTo(target: AppliesTo): boolean {
    const token = target.value().match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
    if (token) {
      const ent = this.#values.find((e) => e.name().value() === token[1]);
      return ent !== undefined && (token[2] === undefined || ent.attrNamed(token[2]) !== null);
    }
    return this.#values.some((e) => target.value().toLowerCase().includes(e.name().value().toLowerCase()));
  }

  toArray(): readonly EntityDecl[] {
    return this.#values;
  }
}

export interface ShapeError {
  readonly element: ElementPath;
  readonly detail: string;
}

export class ShapeErrors {
  readonly #values: readonly ShapeError[];

  private constructor(values: readonly ShapeError[]) {
    this.#values = values;
  }

  static of(values: readonly ShapeError[]): ShapeErrors {
    return new ShapeErrors([...values]);
  }

  add(value: ShapeError): ShapeErrors {
    return new ShapeErrors([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ShapeError> {
    yield* this.#values;
  }

  toArray(): readonly ShapeError[] {
    return this.#values;
  }
}

export interface DeclaredEntitiesSeed {
  readonly entities: EntityDecls;
  readonly rels: RelDecls; // top-level relationships
  readonly shapeErrors: ShapeErrors;
}

// entities.md の宣言集合。参照解決・applies-to 解決・ライフサイクル対象の
// 選定はエンティティコレクションに委ね、最上位と各エンティティ配下の関係の
// 合成順（凍結）を所有する。
export class DeclaredEntities {
  readonly #seed: DeclaredEntitiesSeed;

  private constructor(seed: DeclaredEntitiesSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: DeclaredEntitiesSeed): DeclaredEntities {
    return new DeclaredEntities(seed);
  }

  entities(): EntityDecls {
    return this.#seed.entities;
  }

  shapeErrors(): ShapeErrors {
    return this.#seed.shapeErrors;
  }

  // 最上位＋各エンティティ配下の全関係宣言（旧 allRels の合成順）。
  allRels(): RelDecls {
    let all = this.#seed.rels;
    for (const e of this.#seed.entities) all = all.concat(e.rels());
    return all;
  }
}

export type EntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly model: DeclaredEntities };

// ---- rules.md ---------------------------------------------------------------

export interface RuleDeclSeed {
  readonly id: BusinessRuleId | null;
  readonly element: ElementPath;
  readonly category: RuleCategory | null;
  readonly appliesTo: AppliesTo | null;
  readonly sourceIds: SourceIds;
  // 欠落キー名の列（文言材料——語彙値ではない）。
  readonly missing: readonly string[];
}

// 規則宣言。finding target の選定（BR 形なら自分の id、でなければ族の
// フォールバック）・source id の逆検証・category の閉集合整合を所有する。
export class RuleDecl {
  readonly #seed: RuleDeclSeed;

  private constructor(seed: RuleDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: RuleDeclSeed): RuleDecl {
    return new RuleDecl(seed);
  }

  id(): BusinessRuleId | null {
    return this.#seed.id;
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  category(): RuleCategory | null {
    return this.#seed.category;
  }

  appliesTo(): AppliesTo | null {
    return this.#seed.appliesTo;
  }

  missing(): readonly string[] {
    return this.#seed.missing;
  }

  // 旧 `r.id !== null && /^BR…$/.test(r.id) ? r.id : fallback` の移設。
  findingTarget(fallback: string): string {
    return this.#seed.id !== null && this.#seed.id.matchesShape() ? this.#seed.id.value() : fallback;
  }

  // FD-R3: requirements.md に存在しない source id（値の昇順——凍結順）。
  sourceIdValuesMissingFrom(known: RequirementIds): string[] {
    return this.#seed.sourceIds.valuesMissingFrom(known);
  }

  categoryOutsideClosedSet(): boolean {
    return this.#seed.category !== null && !this.#seed.category.isKnownCategory();
  }
}

export class RuleDecls {
  readonly #values: readonly RuleDecl[];

  private constructor(values: readonly RuleDecl[]) {
    this.#values = values;
  }

  static of(values: readonly RuleDecl[]): RuleDecls {
    return new RuleDecls([...values]);
  }

  add(value: RuleDecl): RuleDecls {
    return new RuleDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RuleDecl> {
    yield* this.#values;
  }

  toArray(): readonly RuleDecl[] {
    return this.#values;
  }
}

export type RulesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "no-rules-list" }
  | { readonly kind: "extracted"; readonly rules: RuleDecls };

// ---- functional-spec.md -----------------------------------------------------

export interface StateMachineSketchSeed {
  readonly spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
  readonly states: StateNames;
  readonly fenceLine: number;
  readonly unsupported: string | null; // 文言材料（理由のプローズ）
}

// 状態機械の素描。自分の位置ラベル（凍結書式）と spec 分解を所有する。
export class StateMachineSketch {
  readonly #seed: StateMachineSketchSeed;

  private constructor(seed: StateMachineSketchSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: StateMachineSketchSeed): StateMachineSketch {
    return new StateMachineSketch(seed);
  }

  spec(): MachineSpec {
    return this.#seed.spec;
  }

  states(): StateNames {
    return this.#seed.states;
  }

  unsupported(): string | null {
    return this.#seed.unsupported;
  }

  // 境界: witness と skip 文言に載る位置ラベル（凍結書式）。
  locationLabel(): string {
    return `State Machine: ${this.#seed.spec.value()} (fence line ${this.#seed.fenceLine})`;
  }
}

export class StateMachineSketches {
  readonly #values: readonly StateMachineSketch[];

  private constructor(values: readonly StateMachineSketch[]) {
    this.#values = values;
  }

  static of(values: readonly StateMachineSketch[]): StateMachineSketches {
    return new StateMachineSketches([...values]);
  }

  add(value: StateMachineSketch): StateMachineSketches {
    return new StateMachineSketches([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<StateMachineSketch> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly StateMachineSketch[] {
    return this.#values;
  }
}

export type FunctionalSpecOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly machines: StateMachineSketches };

// ---- components.md (XS) -----------------------------------------------------

export interface DomainEntitySketchSeed {
  readonly name: EntityName;
  readonly component: ComponentName;
  readonly attributes: AttributeNames;
}

// domain-design 側エンティティの素描。functional-design 側との被覆差分と
// カタログ位置ラベル（凍結書式）を所有する。
export class DomainEntitySketch {
  readonly #seed: DomainEntitySketchSeed;

  private constructor(seed: DomainEntitySketchSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: DomainEntitySketchSeed): DomainEntitySketch {
    return new DomainEntitySketch(seed);
  }

  name(): EntityName {
    return this.#seed.name;
  }

  // 境界: witness に載るカタログ位置ラベル（凍結書式）。
  catalogLabel(): string {
    return `entity ${this.#seed.name.value()} (component ${this.#seed.component.value()})`;
  }

  // XS-3: このユニットの定義が落としている属性（値の昇順——凍結順）。
  attributesDroppedIn(unitAttrs: AttributeNames): string[] {
    return this.#seed.attributes
      .toArray()
      .filter((a) => !unitAttrs.coversNormalized(a))
      .map((a) => a.value())
      .sort();
  }
}

// domain-design 側素描のコレクション。名前順の整列と正規化名での一意化
// （XS 検査の凍結挙動）を所有する。
export class DomainEntitySketches {
  readonly #values: readonly DomainEntitySketch[];

  private constructor(values: readonly DomainEntitySketch[]) {
    this.#values = values;
  }

  static of(values: readonly DomainEntitySketch[]): DomainEntitySketches {
    return new DomainEntitySketches([...values]);
  }

  add(value: DomainEntitySketch): DomainEntitySketches {
    return new DomainEntitySketches([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DomainEntitySketch> {
    yield* this.#values;
  }

  // 名前昇順に整列し、正規化名の初出だけを残す（XS の巡回順——凍結）。
  sortedDistinctByNormalizedName(): DomainEntitySketch[] {
    const sorted = [...this.#values].sort((a, b) => (a.name().value() < b.name().value() ? -1 : 1));
    const seen = new Set<string>();
    const out: DomainEntitySketch[] = [];
    for (const de of sorted) {
      const key = de.name().normalized();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(de);
    }
    return out;
  }

  toArray(): readonly DomainEntitySketch[] {
    return this.#values;
  }
}

export type DomainEntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly error: string }
  | { readonly kind: "extracted"; readonly entities: DomainEntitySketches };

// 兄弟ユニットの entities.md 索引。ユニット横断の定義元探索と、ユニット内の
// 正規化名解決という集合の知識を所有する（XS 検査の凍結挙動）。
export class SiblingUnitIndex {
  readonly #units: ReadonlyMap<string, ReadonlyMap<string, { name: EntityName; attrs: AttributeNames }>>;

  private constructor(units: ReadonlyMap<string, ReadonlyMap<string, { name: EntityName; attrs: AttributeNames }>>) {
    this.#units = units;
  }

  static of(units: ReadonlyMap<string, ReadonlyMap<string, { name: EntityName; attrs: AttributeNames }>>): SiblingUnitIndex {
    return new SiblingUnitIndex(new Map(units));
  }

  // この正規化名のエンティティを定義しているユニット（登録順——凍結順）。
  definersOf(normalizedName: string): string[] {
    return [...this.#units.entries()].filter(([, m]) => m.has(normalizedName)).map(([u]) => u);
  }

  entityDeclaredIn(unit: string, normalizedName: string): { name: EntityName; attrs: AttributeNames } | undefined {
    return this.#units.get(unit)?.get(normalizedName);
  }

  hasAnyUnit(): boolean {
    return this.#units.size > 0;
  }
}
