import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import type { AllowedValues } from "./allowed-values.ts";
import type { AttributeDefault } from "./attribute-default.ts";
import type { AttributeName } from "./attribute-name.ts";
import type { CheckFamily } from "./check-family.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityDeclarations } from "./entity-declarations.ts";
import type { EntityName } from "./entity-name.ts";
import { FD_E2, FD_E3, FD_E6, FD_S1, FD_S2 } from "./functional-check-families.ts";
import type { NumericBound } from "./numeric-bound.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { ReferenceTarget } from "./reference-target.ts";
import type { StateNames } from "./state-names.ts";
import type { TypeName } from "./type-name.ts";
import { WitnessReference } from "./witness-reference.ts";

// 属性宣言。型区分との整合・範囲と既定値の整合・ライフサイクル候補性という
// ドメイン知識を自分で判定する（旧 FD-E2/E3 の条件式の移設）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type AttributeDeclarationParam = {
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
};

export class AttributeDeclaration {
  readonly #name: AttributeName;
  readonly #element: ElementPath;
  readonly #type: TypeName | null;
  readonly #uniqueIsTrue: boolean;
  readonly #references: ReferenceTarget | null;
  readonly #allowed: AllowedValues | null;
  readonly #def: AttributeDefault | null;
  readonly #minDeclared: boolean;
  readonly #maxDeclared: boolean;
  readonly #min: NumericBound | null;
  readonly #max: NumericBound | null;

  private constructor(seed: AttributeDeclarationParam) {
    this.#name = seed.name;
    this.#element = seed.element;
    this.#type = seed.type;
    this.#uniqueIsTrue = seed.uniqueIsTrue;
    this.#references = seed.references;
    this.#allowed = seed.allowed;
    this.#def = seed.def;
    this.#minDeclared = seed.minDeclared;
    this.#maxDeclared = seed.maxDeclared;
    this.#min = seed.min;
    this.#max = seed.max;
  }

  static of(seed: AttributeDeclarationParam): AttributeDeclaration {
    return new AttributeDeclaration(seed);
  }

  #record(
    report: ReferenceCheckReport,
    family: CheckFamily,
    entity: EntityName,
    artifact: ArtifactPath,
    value: string | undefined,
    detail: string,
    kind = FindingKind.structureInvalid(),
  ): void {
    const label = `${entity.asString()}.${this.#name.asString()}`;
    report.finding(
      family,
      kind,
      FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("attr", label)), []),
      [WitnessReference.at(artifact.asString(), this.#element.asString(), value)],
      detail,
    );
  }

  checkDiagramStates(
    states: StateNames,
    report: ReferenceCheckReport,
    entity: EntityName,
    specArtifact: ArtifactPath,
    entitiesArtifact: ArtifactPath,
    el: string,
  ): void {
    const specArt = specArtifact.asString();
    const entitiesArt = entitiesArtifact.asString();
    const attrId = TargetIdentifiers.safe("attr", `${entity.asString()}.${this.#name.asString()}`);
    const rogue = this.rogueDiagramStates(states);
    if (rogue.length > 0) {
      report.finding(
        FD_S1,
        FindingKind.consistencyMismatch(),
        FindingTargets.of(TargetIdentifier.of(attrId), []),
        rogue.map((v) => WitnessReference.at(specArt, el, v)),
        `diagram state(s) ${rogue.join(", ")} are not allowed values of ${entity.asString()}.${this.#name.asString()} in entities.md`,
      );
    }
    const dangling = this.allowedValuesAbsentFrom(states);
    if (dangling.length > 0) {
      report.finding(
        FD_S2,
        FindingKind.consistencyMismatch(),
        FindingTargets.of(TargetIdentifier.of(attrId), []),
        dangling.map((v) => WitnessReference.at(entitiesArt, this.#element.asString(), v)),
        `allowed value(s) ${dangling.join(", ")} of ${entity.asString()}.${this.#name.asString()} appear in no diagram state`,
      );
    }
  }

  checkType(report: ReferenceCheckReport, entity: EntityName, artifact: ArtifactPath): void {
    const label = `${entity.asString()}.${this.#name.asString()}`;
    if (this.declaresAllowedValuesOnNonEnumerableType())
      this.#record(
        report,
        FD_E2,
        entity,
        artifact,
        this.typeToken(),
        `"${label}" declares allowed values but its type "${this.typeText()}" is not an enumerable type`,
      );
    if (this.declaresBoundsOnNonNumericType())
      this.#record(
        report,
        FD_E2,
        entity,
        artifact,
        this.typeToken(),
        `"${label}" declares min/max but its type "${this.typeText()}" is not numeric or date-like`,
      );
    if (this.declaresUniqueOnCollectionType())
      this.#record(
        report,
        FD_E2,
        entity,
        artifact,
        this.typeToken(),
        `"${label}" declares unique but its type "${this.typeText()}" is not scalar`,
      );
  }

  checkBounds(report: ReferenceCheckReport, entity: EntityName, artifact: ArtifactPath): void {
    const label = `${entity.asString()}.${this.#name.asString()}`;
    if (this.boundsInverted())
      this.#record(
        report,
        FD_E3,
        entity,
        artifact,
        `min ${this.#min?.asNumber()} > max ${this.#max?.asNumber()}`,
        `"${label}": min ${this.#min?.asNumber()} exceeds max ${this.#max?.asNumber()}`,
      );
    if (this.defaultBelowMin())
      this.#record(
        report,
        FD_E3,
        entity,
        artifact,
        this.#def?.render(),
        `"${label}": default ${this.#def?.render()} is below min ${this.#min?.asNumber()}`,
      );
    if (this.defaultAboveMax())
      this.#record(
        report,
        FD_E3,
        entity,
        artifact,
        this.#def?.render(),
        `"${label}": default ${this.#def?.render()} is above max ${this.#max?.asNumber()}`,
      );
    if (this.defaultOutsideAllowed())
      this.#record(
        report,
        FD_E3,
        entity,
        artifact,
        this.#def?.render(),
        `"${label}": default "${this.#def?.render()}" is not one of the allowed values`,
      );
  }

  checkReference(
    entities: EntityDeclarations,
    report: ReferenceCheckReport,
    entity: EntityName,
    artifact: ArtifactPath,
  ): void {
    const reference = this.#references;
    if (reference !== null && !entities.resolvesReference(reference))
      this.#record(
        report,
        FD_E6,
        entity,
        artifact,
        reference.asString(),
        `"${entity.asString()}.${this.#name.asString()}" references "${reference.asString()}" which is not a declared entity`,
        FindingKind.referenceBroken(),
      );
  }

  name(): AttributeName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  hasAllowedValues(): boolean {
    return this.#allowed !== null;
  }

  // 境界: witness の location value に載る型トークン（未宣言は ""——凍結形）。
  typeToken(): string {
    return this.#type === null ? "" : this.#type.normalized();
  }

  // 境界: 文言に載る型の描画形（未宣言は旧 `${null}` の "null"——凍結形）。
  typeText(): string {
    return this.#type === null ? "null" : this.#type.asString();
  }

  // FD-E2: 列挙できない型区分（数値・日付・真偽）に allowed_values を宣言。
  declaresAllowedValuesOnNonEnumerableType(): boolean {
    const t = this.#type;
    if (t === null || this.#allowed === null) return false;
    return t.classifiesNumeric() || t.classifiesDate() || t.classifiesBool();
  }

  // FD-E2: 数値・日付でない型に min/max を宣言（型未宣言は FD-E2 の対象外——凍結）。
  declaresBoundsOnNonNumericType(): boolean {
    const t = this.#type;
    if (!(this.#minDeclared || this.#maxDeclared)) return false;
    if (t === null || t.normalized() === "") return false;
    return !t.classifiesNumeric() && !t.classifiesDate();
  }

  // FD-E2: コレクション型に unique を宣言。
  declaresUniqueOnCollectionType(): boolean {
    return this.#uniqueIsTrue && (this.#type?.classifiesCollection() ?? false);
  }

  // FD-E3: min > max の範囲逆転。
  boundsInverted(): boolean {
    return this.#min !== null && this.#max !== null && this.#min.exceeds(this.#max);
  }

  // FD-E3: 数値既定値が範囲の外。
  defaultBelowMin(): boolean {
    const d = this.#def;
    return d !== null && this.#min !== null && d.belowBound(this.#min);
  }

  defaultAboveMax(): boolean {
    const d = this.#def;
    return d !== null && this.#max !== null && d.aboveBound(this.#max);
  }

  // FD-E3: 文字列既定値が allowed_values の外。
  defaultOutsideAllowed(): boolean {
    const d = this.#def;
    if (this.#allowed === null || d === null || !d.isString()) return false;
    return !this.#allowed.containsValue(d.asString());
  }

  // ライフサイクル属性の候補性（status/state の名を帯び allowed を持つ）。
  bearsLifecycleName(): boolean {
    return this.#name.isLifecycleName();
  }

  // FD-S1: 図の状態のうち allowed values に無いもの（差分はコレクションが計算）。
  rogueDiagramStates(states: StateNames): string[] {
    return this.#allowed === null ? [] : this.#allowed.rogueAmong(states);
  }

  // FD-S2: allowed values のうちどの図状態にも現れないもの。
  allowedValuesAbsentFrom(states: StateNames): string[] {
    return this.#allowed === null ? [] : this.#allowed.absentFrom(states);
  }
}
