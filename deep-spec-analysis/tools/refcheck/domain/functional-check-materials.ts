// FD/XS 検査ファミリー — 型付き入力上の純検査。
// finding/skip の文言・targets・witness refs・skip の発行順は旧センサー本体
// からの逐語移動（golden バイト凍結。並びはソートで正規化されるが、tie の
// 挙動まで変えないため発行順も保存する）。

import { TargetIds } from "../../kernel/domain/index.ts";
import { CheckFamily } from "./check-family.ts";
import { CheckFamilies } from "./check-families.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import { type DeclaredEntities } from "./declared-entities.ts";
import { type RuleDecls } from "./rule-decls.ts";
import { WitnessRef } from "./witness-ref.ts";
import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import type { DomainEntitiesOutcome } from "./domain-entities-outcome.ts";
import type { EntitiesOutcome } from "./entities-outcome.ts";
import type { FunctionalSpecOutcome } from "./functional-spec-outcome.ts";
import type { RulesOutcome } from "./rules-outcome.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";
import type { UnitName } from "./unit-name.ts";

const FD_E1 = CheckFamily.reconstitute("FD-E1");
const FD_E2 = CheckFamily.reconstitute("FD-E2");
const FD_E3 = CheckFamily.reconstitute("FD-E3");
const FD_E4 = CheckFamily.reconstitute("FD-E4");
const FD_E5 = CheckFamily.reconstitute("FD-E5");
const FD_E6 = CheckFamily.reconstitute("FD-E6");
const FD_R1 = CheckFamily.reconstitute("FD-R1");
const FD_R2 = CheckFamily.reconstitute("FD-R2");
const FD_R3 = CheckFamily.reconstitute("FD-R3");
const FD_R4 = CheckFamily.reconstitute("FD-R4");
const FD_R5 = CheckFamily.reconstitute("FD-R5");
const FD_S1 = CheckFamily.reconstitute("FD-S1");
const FD_S2 = CheckFamily.reconstitute("FD-S2");
const XS_1 = CheckFamily.reconstitute("XS-1");
const XS_2 = CheckFamily.reconstitute("XS-2");
const XS_3 = CheckFamily.reconstitute("XS-3");

export const FUNCTIONAL_FAMILIES = CheckFamilies.of([
  FD_E1, FD_E2, FD_E3, FD_E4, FD_E5, FD_E6,
  FD_R1, FD_R2, FD_R3, FD_R4, FD_R5,
  FD_S1, FD_S2,
  XS_1, XS_2, XS_3,
]);


function ref(artifact: string, element: string, value?: string): WitnessRef {
  return WitnessRef.reconstitute(value === undefined ? { artifact, element } : { artifact, element, value });
}

function runFunctionalChecksImpl(materials: {
  readonly unit: UnitName | undefined;
  readonly entitiesArtifact: ArtifactPath;
  readonly entities: EntitiesOutcome;
  readonly rulesArtifact: ArtifactPath;
  readonly rules: RulesOutcome;
  readonly specArtifact: ArtifactPath;
  readonly spec: FunctionalSpecOutcome;
  // requirements.md が読めたときはその FR/NFR id 集合、読めなければ null。
  readonly requirementIdsKnown: RequirementIds | null;
  readonly componentsArtifact: ArtifactPath;
  readonly domainEntities: DomainEntitiesOutcome;
  readonly siblingUnits: SiblingUnitIndex;
  }, ledger: CheckFamilyLedger): void {
  const entitiesArt = materials.entitiesArtifact.asString();

  // --- entities.md ----------------------------------------------------------
  const entities: DeclaredEntities | null = materials.entities.match({
    absent: () => {
      for (const f of [FD_E1, FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
        ledger.skip(f, "absent-input", "entities.md is not present in this unit's functional-design record");
      }
      return null;
    },
    wrongFenceCount: (found) => {
      ledger.finding(FD_E1, "structure-invalid", [FD_E1.asCheckTarget()], [ref(entitiesArt, "yaml fence")],
        `entities.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
      for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
        ledger.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
      }
      return null;
    },
    unparseable: (line, error) => {
      ledger.finding(FD_E1, "structure-invalid", [FD_E1.asCheckTarget()], [ref(entitiesArt, `yaml fence (line ${line.asNumber()})`)],
        `yaml block does not parse in the supported subset: ${error}`);
      for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
        ledger.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
      }
      return null;
    },
    extracted: (model) => {
      for (const e of model.shapeErrors()) {
        ledger.finding(FD_E1, "structure-invalid", [FD_E1.asCheckTarget()], [ref(entitiesArt, e.element().asString())], e.detail());
      }
      for (const dup of model.entities().duplicatesByName()) {
        ledger.finding(FD_E1, "structure-invalid", [TargetIds.safe("entity", dup.name().asString())], [ref(entitiesArt, `${dup.element().asString()}.name`, dup.name().asString())],
          `entity "${dup.name().asString()}" is declared more than once`);
      }
      for (const e of model.entities()) {
        for (const dup of e.attrs().duplicatesByName()) {
          ledger.finding(FD_E1, "structure-invalid", [TargetIds.safe("attr", `${e.name().asString()}.${dup.name().asString()}`)], [ref(entitiesArt, `${dup.element().asString()}.name`, dup.name().asString())],
            `attribute "${e.name().asString()}.${dup.name().asString()}" is declared more than once`);
        }
      }
      return model;
    },
  });

  if (entities !== null) {
    for (const e of entities.entities()) {
      for (const a of e.attrs()) {
        const attrId = TargetIds.safe("attr", `${e.name().asString()}.${a.name().asString()}`);
        const label = `${e.name().asString()}.${a.name().asString()}`;
        // FD-E2: 型区分整合は属性宣言が自分で判定する。
        if (a.declaresAllowedValuesOnNonEnumerableType()) {
          ledger.finding(FD_E2, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), a.typeToken())],
            `"${label}" declares allowed values but its type "${a.typeText()}" is not an enumerable type`);
        }
        if (a.declaresBoundsOnNonNumericType()) {
          ledger.finding(FD_E2, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), a.typeToken())],
            `"${label}" declares min/max but its type "${a.typeText()}" is not numeric or date-like`);
        }
        if (a.declaresUniqueOnCollectionType()) {
          ledger.finding(FD_E2, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), a.typeToken())],
            `"${label}" declares unique but its type "${a.typeText()}" is not scalar`);
        }
        // FD-E3: 範囲・既定値の整合も属性宣言が告げる。
        if (a.boundsInverted()) {
          ledger.finding(FD_E3, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), `min ${a.min()?.asNumber()} > max ${a.max()?.asNumber()}`)],
            `"${label}": min ${a.min()?.asNumber()} exceeds max ${a.max()?.asNumber()}`);
        }
        if (a.defaultBelowMin()) {
          ledger.finding(FD_E3, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), a.def()?.render() ?? "")],
            `"${label}": default ${a.def()?.render()} is below min ${a.min()?.asNumber()}`);
        }
        if (a.defaultAboveMax()) {
          ledger.finding(FD_E3, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), a.def()?.render() ?? "")],
            `"${label}": default ${a.def()?.render()} is above max ${a.max()?.asNumber()}`);
        }
        if (a.defaultOutsideAllowed()) {
          ledger.finding(FD_E3, "structure-invalid", [attrId], [ref(entitiesArt, a.element().asString(), a.def()?.render() ?? "")],
            `"${label}": default "${a.def()?.render()}" is not one of the allowed values`);
        }
        // FD-E6: 参照の解決は宣言集合が告げる。
        const reference = a.references();
        if (reference !== null && !entities.entities().resolvesReference(reference)) {
          ledger.finding(FD_E6, "reference-broken", [attrId], [ref(entitiesArt, a.element().asString(), reference.asString())],
            `"${label}" references "${reference.asString()}" which is not a declared entity`);
        }
      }
    }
    // FD-E4 / FD-E5: 関係宣言が自分の整合を告げる。
    for (const r of entities.allRels()) {
      for (const endpoint of [r.from(), r.to()]) {
        if (endpoint !== null && !entities.entities().containsNamed(endpoint.asString())) {
          ledger.finding(FD_E4, "reference-broken", [TargetIds.safe("entity", endpoint.asString())], [ref(entitiesArt, r.element().asString(), endpoint.asString())],
            `relationship endpoint "${endpoint.asString()}" is not a declared entity`);
        }
      }
      if (r.cardinalityOutsideClosedSet()) {
        ledger.finding(FD_E5, "structure-invalid", [FD_E5.asCheckTarget()], [ref(entitiesArt, r.element().asString(), r.cardinality()?.asString() ?? "")],
          `cardinality "${r.cardinality()?.asString()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
      }
      if (r.cardinalityWithoutDirection()) {
        ledger.finding(FD_E5, "structure-invalid", [FD_E5.asCheckTarget()], [ref(entitiesArt, r.element().asString())],
          "relationship declares a cardinality but no direction (from/to or direction key)");
      }
    }
  }

  // --- rules.md -------------------------------------------------------------
  const rulesArt = materials.rulesArtifact.asString();
  const blockRs = (why: string): void => {
    for (const f of [FD_R2, FD_R3, FD_R4, FD_R5]) ledger.skip(f, "unrecognized-format", why);
  };
  const rules: RuleDecls | null = materials.rules.match({
    absent: () => {
      for (const f of [FD_R1, FD_R2, FD_R3, FD_R4, FD_R5]) {
        ledger.skip(f, "absent-input", "rules.md is not present in this unit's functional-design record");
      }
      return null;
    },
    wrongFenceCount: (found) => {
      ledger.finding(FD_R1, "structure-invalid", [FD_R1.asCheckTarget()], [ref(rulesArt, "yaml fence")],
        `rules.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
      blockRs("blocked by FD-R1: the rules yaml block is unusable");
      return null;
    },
    unparseable: (line, error) => {
      ledger.finding(FD_R1, "structure-invalid", [FD_R1.asCheckTarget()], [ref(rulesArt, `yaml fence (line ${line.asNumber()})`)],
        `yaml block does not parse in the supported subset: ${error}`);
      blockRs("blocked by FD-R1: the rules yaml block is unusable");
      return null;
    },
    noRulesList: () => {
      ledger.finding(FD_R1, "structure-invalid", [FD_R1.asCheckTarget()], [ref(rulesArt, "rules")],
        "top-level `rules:` list is missing");
      blockRs("blocked by FD-R1: the rules yaml block is unusable");
      return null;
    },
    extracted: (ruleDecls) => {
      for (const r of ruleDecls) {
        if (r.missing().length > 0) {
          ledger.finding(FD_R1, "structure-invalid", [r.findingTarget("check:FD-R1")],
            [ref(rulesArt, r.element().asString())],
            `rule is missing required key(s): ${r.missing().join(", ")}`);
        }
      }
      return ruleDecls;
    },
  });

  if (rules !== null) {
    // FD-R2: id shape + uniqueness
    const seenIds = new Set<string>();
    for (const r of rules) {
      const id = r.id();
      if (id === null) continue;
      if (!id.matchesShape()) {
        ledger.finding(FD_R2, "structure-invalid", [FD_R2.asCheckTarget()], [ref(rulesArt, `${r.element().asString()}.id`, id.asString())],
          `rule id "${id.asString()}" does not match BR{group}.{seq}`);
        continue;
      }
      if (seenIds.has(id.asString())) {
        ledger.finding(FD_R2, "structure-invalid", [id.asString()], [ref(rulesArt, `${r.element().asString()}.id`, id.asString())],
          `rule id "${id.asString()}" is declared more than once`);
      }
      seenIds.add(id.asString());
    }
    // FD-R3: source FR/NFR ids exist in requirements.md
    if (materials.requirementIdsKnown === null) {
      ledger.skip(FD_R3, "absent-input", "requirements.md not found under this intent record — source ids cannot be reverse-verified");
    } else {
      const known = materials.requirementIdsKnown;
      for (const r of rules) {
        const missing = r.sourceIdValuesMissingFrom(known);
        if (missing.length > 0) {
          ledger.finding(FD_R3, "reference-broken",
            [r.findingTarget("check:FD-R3")],
            missing.map((id) => ref(rulesArt, `${r.element().asString()}.source`, id)),
            `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
        }
      }
    }
    // FD-R4: applies-to resolves against entities.md
    if (entities === null) {
      ledger.skip(FD_R4, "absent-input", "entities.md is unavailable — applies-to cannot be resolved");
    } else {
      for (const r of rules) {
        const appliesTo = r.appliesTo();
        if (appliesTo === null) continue;
        if (!entities.entities().resolvesAppliesTo(appliesTo)) {
          ledger.finding(FD_R4, "reference-broken",
            [r.findingTarget("check:FD-R4")],
            [ref(rulesArt, r.element().asString(), appliesTo.asString())],
            `applies-to "${appliesTo.asString()}" does not resolve to a declared entity or entity.attribute`);
        }
      }
    }
    // FD-R5: category closed set
    for (const r of rules) {
      if (r.categoryOutsideClosedSet()) {
        ledger.finding(FD_R5, "structure-invalid",
          [r.findingTarget("check:FD-R5")],
          [ref(rulesArt, `${r.element().asString()}.category`, r.category()?.asString() ?? "")],
          `category "${r.category()?.asString()}" is not one of validation | authorization | constraint | calculation | policy`);
      }
    }
  }

  // --- functional-spec.md state machines ------------------------------------
  const specArt = materials.specArtifact.asString();
  materials.spec.match({
    absent: () => {
      ledger.skip(FD_S1, "absent-input", "functional-spec.md is not present in this unit's functional-design record");
      ledger.skip(FD_S2, "absent-input", "functional-spec.md is not present in this unit's functional-design record");
    },
    present: (machines) => {
      if (entities === null) {
        ledger.skip(FD_S1, "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
        ledger.skip(FD_S2, "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
        return;
      }
      if (machines.isEmpty()) {
        for (const e of entities.entities().lifecycleOnly()) {
          ledger.skip(FD_S1, "unrecognized-format",
            `no \`### State Machine: ${e.name().asString()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().asString()}"`);
          ledger.skip(FD_S2, "unrecognized-format",
            `no \`### State Machine: ${e.name().asString()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().asString()}"`);
        }
      }
      for (const m of machines) {
        const entity = m.spec().entityToken();
        const entName = entity.asString();
        const attrName = m.spec().attributeToken();
        const el = m.locationLabel();
        if (m.unsupported() !== null) {
          ledger.skip(FD_S1, "unrecognized-format", `${el}: ${m.unsupported()}`);
          ledger.skip(FD_S2, "unrecognized-format", `${el}: ${m.unsupported()}`);
          continue;
        }
        const ent = entities.entities().byNormalizedName(entity.normalized());
        if (!ent) {
          ledger.finding(FD_S1, "consistency-mismatch", [TargetIds.safe("entity", entName)], [ref(specArt, el, entName)],
            `state machine names entity "${entName}" which is not declared in entities.md`);
          continue;
        }
        const attr = attrName !== undefined ? ent.attrNamed(attrName) : ent.lifecycleAttr();
        if (!attr || !attr.hasAllowedValues()) {
          ledger.skip(FD_S1, "unrecognized-format",
            `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
          ledger.skip(FD_S2, "unrecognized-format",
            `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
          continue;
        }
        // FD-S1/S2: 図と allowed の差分は属性宣言が自分で告げる。
        const attrId = TargetIds.safe("attr", `${ent.name().asString()}.${attr.name().asString()}`);
        const rogue = attr.rogueDiagramStates(m.states());
        if (rogue.length > 0) {
          ledger.finding(FD_S1, "consistency-mismatch", [attrId],
            rogue.map((v) => ref(specArt, el, v)),
            `diagram state(s) ${rogue.join(", ")} are not allowed values of ${ent.name().asString()}.${attr.name().asString()} in entities.md`);
        }
        const dangling = attr.allowedValuesAbsentFrom(m.states());
        if (dangling.length > 0) {
          ledger.finding(FD_S2, "consistency-mismatch", [attrId],
            dangling.map((v) => ref(entitiesArt, attr.element().asString(), v)),
            `allowed value(s) ${dangling.join(", ")} of ${ent.name().asString()}.${attr.name().asString()} appear in no diagram state`);
        }
      }
    },
  });

  // --- XS: domain-design vs functional-design entities ------------------------
  const compArt = materials.componentsArtifact.asString();
  materials.domainEntities.match({
    absent: () => {
      for (const f of [XS_1, XS_2, XS_3]) {
        ledger.skip(f, "absent-input", "domain-design components.md is not present under this intent record");
      }
    },
    unusable: (error) => {
      for (const f of [XS_1, XS_2, XS_3]) {
        ledger.skip(f, "unrecognized-format", `components.md yaml block is unusable (${error})`);
      }
    },
    extracted: (domainEntities) => {
      const unitEntities = materials.siblingUnits;
      // 正規化名での一意化と整列はコレクションが所有する（重複宣言そのものは
      // DD-5 の finding）。
      for (const de of domainEntities.sortedDistinctByNormalizedName()) {
        const key = de.name().normalized().asString();
        const definers = unitEntities.definersOf(key);
        if (definers.length >= 2) {
          ledger.finding(XS_1, "consistency-mismatch", [TargetIds.safe("entity", de.name().asString())],
            [ref(compArt, de.catalogLabel()),
              ...definers.map((u) => ref(`construction/${u}/functional-design/entities.md`, `entity ${de.name().asString()}`))],
            `domain entity "${de.name().asString()}" is defined in ${definers.length} units (${definers.join(", ")}) — ownership is duplicated`);
        } else if (definers.length === 0 && unitEntities.hasAnyUnit()) {
          ledger.finding(XS_2, "consistency-mismatch", [TargetIds.safe("entity", de.name().asString())],
            [ref(compArt, de.catalogLabel())],
            `domain entity "${de.name().asString()}" is defined in no unit's entities.md — it was dropped on the way to functional design`);
        }
        // XS-3: 属性の取り落としは素描が自分で告げる（このユニットの定義に対してのみ）。
        if (materials.unit !== undefined) {
          const mine = unitEntities.entityDeclaredIn(materials.unit.asString(), key);
          if (mine) {
            const dropped = de.attributesDroppedIn(mine.attrs);
            if (dropped.length > 0) {
              ledger.finding(XS_3, "consistency-mismatch", [TargetIds.safe("entity", de.name().asString())],
                dropped.map((a) => ref(compArt, `entity ${de.name().asString()}.attributes`, a)),
                `domain-design declares attribute(s) ${dropped.join(", ")} on "${de.name().asString()}" that this unit's entities.md does not carry`);
            }
          }
        }
      }
      if (materials.unit === undefined) {
        ledger.skip(XS_3, "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
      }
    },
  });
}

// FD/XS 検査材料。検査の起動は材料自身の振る舞い（OOUI 裁定：旧
// runFunctionalChecks の従属先）。
export class FunctionalCheckMaterials {
  readonly #seed: {
  readonly unit: UnitName | undefined;
  readonly entitiesArtifact: ArtifactPath;
  readonly entities: EntitiesOutcome;
  readonly rulesArtifact: ArtifactPath;
  readonly rules: RulesOutcome;
  readonly specArtifact: ArtifactPath;
  readonly spec: FunctionalSpecOutcome;
  // requirements.md が読めたときはその FR/NFR id 集合、読めなければ null。
  readonly requirementIdsKnown: RequirementIds | null;
  readonly componentsArtifact: ArtifactPath;
  readonly domainEntities: DomainEntitiesOutcome;
  readonly siblingUnits: SiblingUnitIndex;
  };

  private constructor(seed: {
    readonly unit: UnitName | undefined;
    readonly entitiesArtifact: ArtifactPath;
    readonly entities: EntitiesOutcome;
    readonly rulesArtifact: ArtifactPath;
    readonly rules: RulesOutcome;
    readonly specArtifact: ArtifactPath;
    readonly spec: FunctionalSpecOutcome;
    // requirements.md が読めたときはその FR/NFR id 集合、読めなければ null。
    readonly requirementIdsKnown: RequirementIds | null;
    readonly componentsArtifact: ArtifactPath;
    readonly domainEntities: DomainEntitiesOutcome;
    readonly siblingUnits: SiblingUnitIndex;
  }) {
    this.#seed = seed;
  }

  static of(seed: {
    readonly unit: UnitName | undefined;
    readonly entitiesArtifact: ArtifactPath;
    readonly entities: EntitiesOutcome;
    readonly rulesArtifact: ArtifactPath;
    readonly rules: RulesOutcome;
    readonly specArtifact: ArtifactPath;
    readonly spec: FunctionalSpecOutcome;
    // requirements.md が読めたときはその FR/NFR id 集合、読めなければ null。
    readonly requirementIdsKnown: RequirementIds | null;
    readonly componentsArtifact: ArtifactPath;
    readonly domainEntities: DomainEntitiesOutcome;
    readonly siblingUnits: SiblingUnitIndex;
  }): FunctionalCheckMaterials {
    return new FunctionalCheckMaterials(seed);
  }

  runChecks(ledger: CheckFamilyLedger): void {
    runFunctionalChecksImpl(this.#seed, ledger);
  }
}
