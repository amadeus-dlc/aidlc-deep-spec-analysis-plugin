// functional-design（entities.md / rules.md / functional-spec.md）と
// 横断検査（XS）向け domain-design エンティティのドメインオブジェクト。
// 解析（fence/YAML/mermaid/Json 歩き）はアダプタのパーサが行い、ここは
// 宣言が自分の整合性判定（型クラス衝突・範囲逆転・参照解決・被覆差分）を
// 所有する抽象データ型——検査ランナーは尋ねず（ask）、告げる（tell）だけ。
// 判定の意味論と文言材料の描画形は旧 functional-checks の凍結挙動の逐語移設。

import type {
  AllowedValue,
  AppliesTo,
  AttributeDefault,
  AttributeName,
  BusinessRuleId,
  CardinalityNotation,
  ComponentName,
  ElementPath,
  EntityName,
  MachineSpec,
  NumericBound,
  ReferenceTarget,
  RuleCategory,
  SourceId,
  StateName,
  TypeName,
} from "./functional-design-values.ts";

// ---- entities.md ------------------------------------------------------------

export interface AttrDeclSeed {
  readonly name: AttributeName;
  readonly element: ElementPath;
  readonly type: TypeName | null;
  readonly uniqueIsTrue: boolean;
  readonly references: ReferenceTarget | null;
  readonly allowed: readonly AllowedValue[] | null;
  readonly def: AttributeDefault | null;
  readonly minDeclared: boolean;
  readonly maxDeclared: boolean;
  readonly min: NumericBound | null;
  readonly max: NumericBound | null;
}

// 属性宣言。型クラスとの整合・範囲と既定値の整合・ライフサイクル候補性という
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

  // FD-E2: 列挙できない型クラス（数値・日付・真偽）に allowed_values を宣言。
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
    return !this.#seed.allowed.some((v) => v.value() === d.asString());
  }

  // ライフサイクル属性の候補性（status/state の名を帯び allowed を持つ）。
  bearsLifecycleName(): boolean {
    return this.#seed.name.value() === "status" || this.#seed.name.value() === "state";
  }

  // FD-S1: 図の状態のうち allowed values に無いもの（正規化照合・値の昇順）。
  rogueDiagramStates(states: readonly StateName[]): string[] {
    const allowedNorm = new Set((this.#seed.allowed ?? []).map((v) => v.normalized()));
    return states.filter((s) => !allowedNorm.has(s.normalized())).map((s) => s.value()).sort();
  }

  // FD-S2: allowed values のうちどの図状態にも現れないもの。
  allowedValuesAbsentFrom(states: readonly StateName[]): string[] {
    const stateNorm = new Set(states.map((s) => s.normalized()));
    return (this.#seed.allowed ?? []).filter((v) => !stateNorm.has(v.normalized())).map((v) => v.value()).sort();
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

export interface EntityDeclSeed {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly attrs: readonly AttrDecl[];
  readonly rels: readonly RelDecl[];
}

// エンティティ宣言。属性の重複検出・ライフサイクル属性の選定・属性の解決を
// 自分で行う（旧 lifecycleAttrOf 自由関数と seen-set 走査の移設）。
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

  attrs(): readonly AttrDecl[] {
    return this.#seed.attrs;
  }

  rels(): readonly RelDecl[] {
    return this.#seed.rels;
  }

  // 2 回目以降に現れた属性宣言（宣言順——旧 seen-set 走査と同じ列）。
  duplicateAttrDecls(): AttrDecl[] {
    const seen = new Set<string>();
    const dups: AttrDecl[] = [];
    for (const a of this.#seed.attrs) {
      if (seen.has(a.name().value())) dups.push(a);
      seen.add(a.name().value());
    }
    return dups;
  }

  // ライフサイクル属性：status/state の名で allowed を持つもの、無ければ
  // allowed を持つ唯一の属性、それも無ければ null（旧 lifecycleAttrOf）。
  lifecycleAttr(): AttrDecl | null {
    const named = this.#seed.attrs.find((a) => a.bearsLifecycleName() && a.hasAllowedValues());
    if (named) return named;
    const withAllowed = this.#seed.attrs.filter((a) => a.hasAllowedValues());
    return withAllowed.length === 1 ? (withAllowed[0] ?? null) : null;
  }

  attrNamed(token: string): AttrDecl | null {
    return this.#seed.attrs.find((a) => a.name().value() === token) ?? null;
  }
}

export interface ShapeError {
  readonly element: ElementPath;
  readonly detail: string;
}

export interface DeclaredEntitiesSeed {
  readonly entities: readonly EntityDecl[];
  readonly rels: readonly RelDecl[]; // top-level relationships
  readonly shapeErrors: readonly ShapeError[];
}

// entities.md の宣言集合。エンティティの重複・参照解決（FD-E6）・applies-to
// 解決（FD-R4）・ライフサイクル対象の選定という集合知識を所有する。
export class DeclaredEntities {
  readonly #seed: DeclaredEntitiesSeed;
  readonly #names: Set<string>;

  private constructor(seed: DeclaredEntitiesSeed) {
    this.#seed = seed;
    this.#names = new Set(seed.entities.map((e) => e.name().value()));
  }

  static reconstitute(seed: DeclaredEntitiesSeed): DeclaredEntities {
    return new DeclaredEntities(seed);
  }

  entities(): readonly EntityDecl[] {
    return this.#seed.entities;
  }

  shapeErrors(): readonly ShapeError[] {
    return this.#seed.shapeErrors;
  }

  // 最上位＋各エンティティ配下の全関係宣言（旧 allRels の合成順）。
  allRels(): RelDecl[] {
    return [...this.#seed.rels, ...this.#seed.entities.flatMap((e) => [...e.rels()])];
  }

  // 2 回目以降に現れたエンティティ宣言（宣言順）。
  duplicateEntityDecls(): EntityDecl[] {
    const seen = new Set<string>();
    const dups: EntityDecl[] = [];
    for (const e of this.#seed.entities) {
      if (seen.has(e.name().value())) dups.push(e);
      seen.add(e.name().value());
    }
    return dups;
  }

  containsEntityNamed(value: string): boolean {
    return this.#names.has(value);
  }

  // FD-E6: references が宣言済みエンティティへ解決するか。
  // Entity / Entity.attr 形はエンティティ名の厳密照合、自由文は小文字包含の
  // 緩い照合（凍結挙動）。
  resolvesReference(reference: ReferenceTarget): boolean {
    const token = reference.value().match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.[A-Za-z][A-Za-z0-9_]*)?$/);
    if (token) return this.#names.has(token[1] ?? "");
    return this.#seed.entities.some((d) => reference.value().toLowerCase().includes(d.name().value().toLowerCase()));
  }

  // FD-R4: applies-to が Entity / Entity.attribute へ解決するか。
  resolvesAppliesTo(target: AppliesTo): boolean {
    const token = target.value().match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
    if (token) {
      const ent = this.#seed.entities.find((e) => e.name().value() === token[1]);
      return ent !== null && ent !== undefined && (token[2] === undefined || ent.attrNamed(token[2]) !== null);
    }
    return this.#seed.entities.some((e) => target.value().toLowerCase().includes(e.name().value().toLowerCase()));
  }

  entityByNormalizedName(normalized: string): EntityDecl | undefined {
    return this.#seed.entities.find((e) => e.name().normalized() === normalized);
  }

  lifecycleEntities(): EntityDecl[] {
    return this.#seed.entities.filter((e) => e.lifecycleAttr() !== null);
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
  readonly sourceIds: readonly SourceId[];
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
  sourceIdValuesMissingFrom(known: ReadonlySet<string>): string[] {
    return this.#seed.sourceIds.map((id) => id.value()).filter((id) => !known.has(id)).sort();
  }

  categoryOutsideClosedSet(): boolean {
    return this.#seed.category !== null && !this.#seed.category.isKnownCategory();
  }
}

export type RulesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "no-rules-list" }
  | { readonly kind: "extracted"; readonly rules: readonly RuleDecl[] };

// ---- functional-spec.md -----------------------------------------------------

export interface StateMachineSketchSeed {
  readonly spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
  readonly states: readonly StateName[];
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

  states(): readonly StateName[] {
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

export type FunctionalSpecOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly machines: readonly StateMachineSketch[] };

// ---- components.md (XS) -----------------------------------------------------

export interface DomainEntitySketchSeed {
  readonly name: EntityName;
  readonly component: ComponentName;
  readonly attributes: readonly AttributeName[];
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
  attributesDroppedIn(unitAttrs: readonly AttributeName[]): string[] {
    const mineNorm = new Set(unitAttrs.map((a) => a.normalized()));
    return this.#seed.attributes.filter((a) => !mineNorm.has(a.normalized())).map((a) => a.value()).sort();
  }
}

export type DomainEntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly error: string }
  | { readonly kind: "extracted"; readonly entities: readonly DomainEntitySketch[] };

// 正規化名 → { 宣言名, 属性名列 }（XS 検査が消費するユニットごとの索引）。
export type SiblingUnitEntities = Map<string, Map<string, { name: EntityName; attrs: readonly AttributeName[] }>>;
