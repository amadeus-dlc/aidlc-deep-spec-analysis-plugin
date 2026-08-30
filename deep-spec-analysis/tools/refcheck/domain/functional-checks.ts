// FD/XS 検査ファミリー — 型付き入力上の純検査。
// finding/skip の文言・targets・witness refs・skip の発行順は旧センサー本体
// からの逐語移動（golden バイト凍結。並びはソートで正規化されるが、tie の
// 挙動まで変えないため発行順も保存する）。

import { normalizeName, safeTarget } from "../../kernel/domain/index.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import type {
  DomainEntitiesOutcome,
  DeclaredEntities,
  EntitiesOutcome,
  FunctionalSpecOutcome,
  RuleDecls,
  RulesOutcome,
  SiblingUnitIndex,
} from "./functional-design.ts";
import type { WitnessRef } from "./witness-ref.ts";

export const FUNCTIONAL_FAMILIES = [
  "FD-E1", "FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6",
  "FD-R1", "FD-R2", "FD-R3", "FD-R4", "FD-R5",
  "FD-S1", "FD-S2",
  "XS-1", "XS-2", "XS-3",
];

export interface FunctionalCheckMaterials {
  readonly unit: string | undefined;
  readonly entitiesArtifact: string;
  readonly entities: EntitiesOutcome;
  readonly rulesArtifact: string;
  readonly rules: RulesOutcome;
  readonly specArtifact: string;
  readonly spec: FunctionalSpecOutcome;
  // requirements.md が読めたときはその FR/NFR id 集合、読めなければ null。
  readonly requirementIdsKnown: ReadonlySet<string> | null;
  readonly componentsArtifact: string;
  readonly domainEntities: DomainEntitiesOutcome;
  readonly siblingUnits: SiblingUnitIndex;
}

function ref(artifact: string, element: string, value?: string): WitnessRef {
  return value === undefined ? { artifact, element } : { artifact, element, value };
}

export function runFunctionalChecks(input: FunctionalCheckMaterials, ledger: CheckFamilyLedger): void {
  const entitiesArt = input.entitiesArtifact;

  // --- entities.md ----------------------------------------------------------
  let entities: DeclaredEntities | null = null;
  if (input.entities.kind === "absent") {
    for (const f of ["FD-E1", "FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
      ledger.skip(f, "absent-input", "entities.md is not present in this unit's functional-design record");
    }
  } else if (input.entities.kind === "wrong-fence-count") {
    ledger.finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, "yaml fence")],
      `entities.md must carry exactly one fenced yaml source-of-truth block (found ${input.entities.found})`);
    for (const f of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
      ledger.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
    }
  } else if (input.entities.kind === "unparseable") {
    ledger.finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, `yaml fence (line ${input.entities.line})`)],
      `yaml block does not parse in the supported subset: ${input.entities.error}`);
    for (const f of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
      ledger.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
    }
  } else {
    entities = input.entities.model;
    for (const e of entities.shapeErrors()) {
      ledger.finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, e.element.value())], e.detail);
    }
    for (const dup of entities.entities().duplicatesByName()) {
      ledger.finding("FD-E1", "structure-invalid", [safeTarget("entity", dup.name().value())], [ref(entitiesArt, `${dup.element().value()}.name`, dup.name().value())],
        `entity "${dup.name().value()}" is declared more than once`);
    }
    for (const e of entities.entities()) {
      for (const dup of e.attrs().duplicatesByName()) {
        ledger.finding("FD-E1", "structure-invalid", [safeTarget("attr", `${e.name().value()}.${dup.name().value()}`)], [ref(entitiesArt, `${dup.element().value()}.name`, dup.name().value())],
          `attribute "${e.name().value()}.${dup.name().value()}" is declared more than once`);
      }
    }
  }

  if (entities !== null) {
    for (const e of entities.entities()) {
      for (const a of e.attrs()) {
        const attrId = safeTarget("attr", `${e.name().value()}.${a.name().value()}`);
        const label = `${e.name().value()}.${a.name().value()}`;
        // FD-E2: 型区分整合は属性宣言が自分で判定する。
        if (a.declaresAllowedValuesOnNonEnumerableType()) {
          ledger.finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), a.typeToken())],
            `"${label}" declares allowed values but its type "${a.typeText()}" is not an enumerable type`);
        }
        if (a.declaresBoundsOnNonNumericType()) {
          ledger.finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), a.typeToken())],
            `"${label}" declares min/max but its type "${a.typeText()}" is not numeric or date-like`);
        }
        if (a.declaresUniqueOnCollectionType()) {
          ledger.finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), a.typeToken())],
            `"${label}" declares unique but its type "${a.typeText()}" is not scalar`);
        }
        // FD-E3: 範囲・既定値の整合も属性宣言が告げる。
        if (a.boundsInverted()) {
          ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), `min ${a.min()?.value()} > max ${a.max()?.value()}`)],
            `"${label}": min ${a.min()?.value()} exceeds max ${a.max()?.value()}`);
        }
        if (a.defaultBelowMin()) {
          ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), a.def()?.render() ?? "")],
            `"${label}": default ${a.def()?.render()} is below min ${a.min()?.value()}`);
        }
        if (a.defaultAboveMax()) {
          ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), a.def()?.render() ?? "")],
            `"${label}": default ${a.def()?.render()} is above max ${a.max()?.value()}`);
        }
        if (a.defaultOutsideAllowed()) {
          ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element().value(), a.def()?.render() ?? "")],
            `"${label}": default "${a.def()?.render()}" is not one of the allowed values`);
        }
        // FD-E6: 参照の解決は宣言集合が告げる。
        const reference = a.references();
        if (reference !== null && !entities.entities().resolvesReference(reference)) {
          ledger.finding("FD-E6", "reference-broken", [attrId], [ref(entitiesArt, a.element().value(), reference.value())],
            `"${label}" references "${reference.value()}" which is not a declared entity`);
        }
      }
    }
    // FD-E4 / FD-E5: 関係宣言が自分の整合を告げる。
    for (const r of entities.allRels()) {
      for (const endpoint of [r.from(), r.to()]) {
        if (endpoint !== null && !entities.entities().containsNamed(endpoint.value())) {
          ledger.finding("FD-E4", "reference-broken", [safeTarget("entity", endpoint.value())], [ref(entitiesArt, r.element().value(), endpoint.value())],
            `relationship endpoint "${endpoint.value()}" is not a declared entity`);
        }
      }
      if (r.cardinalityOutsideClosedSet()) {
        ledger.finding("FD-E5", "structure-invalid", ["check:FD-E5"], [ref(entitiesArt, r.element().value(), r.cardinality()?.value() ?? "")],
          `cardinality "${r.cardinality()?.value()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
      }
      if (r.cardinalityWithoutDirection()) {
        ledger.finding("FD-E5", "structure-invalid", ["check:FD-E5"], [ref(entitiesArt, r.element().value())],
          "relationship declares a cardinality but no direction (from/to or direction key)");
      }
    }
  }

  // --- rules.md -------------------------------------------------------------
  const rulesArt = input.rulesArtifact;
  let rules: RuleDecls | null = null;
  const blockRs = (why: string): void => {
    for (const f of ["FD-R2", "FD-R3", "FD-R4", "FD-R5"]) ledger.skip(f, "unrecognized-format", why);
  };
  if (input.rules.kind === "absent") {
    for (const f of ["FD-R1", "FD-R2", "FD-R3", "FD-R4", "FD-R5"]) {
      ledger.skip(f, "absent-input", "rules.md is not present in this unit's functional-design record");
    }
  } else if (input.rules.kind === "wrong-fence-count") {
    ledger.finding("FD-R1", "structure-invalid", ["check:FD-R1"], [ref(rulesArt, "yaml fence")],
      `rules.md must carry exactly one fenced yaml source-of-truth block (found ${input.rules.found})`);
    blockRs("blocked by FD-R1: the rules yaml block is unusable");
  } else if (input.rules.kind === "unparseable") {
    ledger.finding("FD-R1", "structure-invalid", ["check:FD-R1"], [ref(rulesArt, `yaml fence (line ${input.rules.line})`)],
      `yaml block does not parse in the supported subset: ${input.rules.error}`);
    blockRs("blocked by FD-R1: the rules yaml block is unusable");
  } else if (input.rules.kind === "no-rules-list") {
    ledger.finding("FD-R1", "structure-invalid", ["check:FD-R1"], [ref(rulesArt, "rules")],
      "top-level `rules:` list is missing");
    blockRs("blocked by FD-R1: the rules yaml block is unusable");
  } else {
    rules = input.rules.rules;
    for (const r of rules) {
      if (r.missing().length > 0) {
        ledger.finding("FD-R1", "structure-invalid", [r.findingTarget("check:FD-R1")],
          [ref(rulesArt, r.element().value())],
          `rule is missing required key(s): ${r.missing().join(", ")}`);
      }
    }
  }

  if (rules !== null) {
    // FD-R2: id shape + uniqueness
    const seenIds = new Set<string>();
    for (const r of rules) {
      const id = r.id();
      if (id === null) continue;
      if (!id.matchesShape()) {
        ledger.finding("FD-R2", "structure-invalid", ["check:FD-R2"], [ref(rulesArt, `${r.element().value()}.id`, id.value())],
          `rule id "${id.value()}" does not match BR{group}.{seq}`);
        continue;
      }
      if (seenIds.has(id.value())) {
        ledger.finding("FD-R2", "structure-invalid", [id.value()], [ref(rulesArt, `${r.element().value()}.id`, id.value())],
          `rule id "${id.value()}" is declared more than once`);
      }
      seenIds.add(id.value());
    }
    // FD-R3: source FR/NFR ids exist in requirements.md
    if (input.requirementIdsKnown === null) {
      ledger.skip("FD-R3", "absent-input", "requirements.md not found under this intent record — source ids cannot be reverse-verified");
    } else {
      const known = input.requirementIdsKnown;
      for (const r of rules) {
        const missing = r.sourceIdValuesMissingFrom(known);
        if (missing.length > 0) {
          ledger.finding("FD-R3", "reference-broken",
            [r.findingTarget("check:FD-R3")],
            missing.map((id) => ref(rulesArt, `${r.element().value()}.source`, id)),
            `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
        }
      }
    }
    // FD-R4: applies-to resolves against entities.md
    if (entities === null) {
      ledger.skip("FD-R4", "absent-input", "entities.md is unavailable — applies-to cannot be resolved");
    } else {
      for (const r of rules) {
        const appliesTo = r.appliesTo();
        if (appliesTo === null) continue;
        if (!entities.entities().resolvesAppliesTo(appliesTo)) {
          ledger.finding("FD-R4", "reference-broken",
            [r.findingTarget("check:FD-R4")],
            [ref(rulesArt, r.element().value(), appliesTo.value())],
            `applies-to "${appliesTo.value()}" does not resolve to a declared entity or entity.attribute`);
        }
      }
    }
    // FD-R5: category closed set
    for (const r of rules) {
      if (r.categoryOutsideClosedSet()) {
        ledger.finding("FD-R5", "structure-invalid",
          [r.findingTarget("check:FD-R5")],
          [ref(rulesArt, `${r.element().value()}.category`, r.category()?.value() ?? "")],
          `category "${r.category()?.value()}" is not one of validation | authorization | constraint | calculation | policy`);
      }
    }
  }

  // --- functional-spec.md state machines ------------------------------------
  const specArt = input.specArtifact;
  if (input.spec.kind === "absent") {
    ledger.skip("FD-S1", "absent-input", "functional-spec.md is not present in this unit's functional-design record");
    ledger.skip("FD-S2", "absent-input", "functional-spec.md is not present in this unit's functional-design record");
  } else if (entities === null) {
    ledger.skip("FD-S1", "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
    ledger.skip("FD-S2", "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
  } else {
    const machines = input.spec.machines;
    if (machines.isEmpty()) {
      for (const e of entities.entities().lifecycleOnly()) {
        ledger.skip("FD-S1", "unrecognized-format",
          `no \`### State Machine: ${e.name().value()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().value()}"`);
        ledger.skip("FD-S2", "unrecognized-format",
          `no \`### State Machine: ${e.name().value()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().value()}"`);
      }
    }
    for (const m of machines) {
      const entName = m.spec().entityToken();
      const attrName = m.spec().attributeToken();
      const el = m.locationLabel();
      if (m.unsupported() !== null) {
        ledger.skip("FD-S1", "unrecognized-format", `${el}: ${m.unsupported()}`);
        ledger.skip("FD-S2", "unrecognized-format", `${el}: ${m.unsupported()}`);
        continue;
      }
      const ent = entities.entities().byNormalizedName(normalizeName(entName));
      if (!ent) {
        ledger.finding("FD-S1", "consistency-mismatch", [safeTarget("entity", entName)], [ref(specArt, el, entName)],
          `state machine names entity "${entName}" which is not declared in entities.md`);
        continue;
      }
      const attr = attrName !== undefined ? ent.attrNamed(attrName) : ent.lifecycleAttr();
      if (!attr || !attr.hasAllowedValues()) {
        ledger.skip("FD-S1", "unrecognized-format",
          `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().value()}"`);
        ledger.skip("FD-S2", "unrecognized-format",
          `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().value()}"`);
        continue;
      }
      // FD-S1/S2: 図と allowed の差分は属性宣言が自分で告げる。
      const attrId = safeTarget("attr", `${ent.name().value()}.${attr.name().value()}`);
      const rogue = attr.rogueDiagramStates(m.states());
      if (rogue.length > 0) {
        ledger.finding("FD-S1", "consistency-mismatch", [attrId],
          rogue.map((v) => ref(specArt, el, v)),
          `diagram state(s) ${rogue.join(", ")} are not allowed values of ${ent.name().value()}.${attr.name().value()} in entities.md`);
      }
      const dangling = attr.allowedValuesAbsentFrom(m.states());
      if (dangling.length > 0) {
        ledger.finding("FD-S2", "consistency-mismatch", [attrId],
          dangling.map((v) => ref(entitiesArt, attr.element().value(), v)),
          `allowed value(s) ${dangling.join(", ")} of ${ent.name().value()}.${attr.name().value()} appear in no diagram state`);
      }
    }
  }

  // --- XS: domain-design vs functional-design entities ------------------------
  const compArt = input.componentsArtifact;
  if (input.domainEntities.kind === "absent") {
    for (const f of ["XS-1", "XS-2", "XS-3"]) {
      ledger.skip(f, "absent-input", "domain-design components.md is not present under this intent record");
    }
  } else if (input.domainEntities.kind === "unusable") {
    for (const f of ["XS-1", "XS-2", "XS-3"]) {
      ledger.skip(f, "unrecognized-format", `components.md yaml block is unusable (${input.domainEntities.error})`);
    }
  } else {
    const domainEntities = input.domainEntities.entities;
    const unitEntities = input.siblingUnits;
    // 正規化名での一意化と整列はコレクションが所有する（重複宣言そのものは
    // DD-5 の finding）。
    for (const de of domainEntities.sortedDistinctByNormalizedName()) {
      const key = de.name().normalized();
      const definers = unitEntities.definersOf(key);
      if (definers.length >= 2) {
        ledger.finding("XS-1", "consistency-mismatch", [safeTarget("entity", de.name().value())],
          [ref(compArt, de.catalogLabel()),
            ...definers.map((u) => ref(`construction/${u}/functional-design/entities.md`, `entity ${de.name().value()}`))],
          `domain entity "${de.name().value()}" is defined in ${definers.length} units (${definers.join(", ")}) — ownership is duplicated`);
      } else if (definers.length === 0 && unitEntities.hasAnyUnit()) {
        ledger.finding("XS-2", "consistency-mismatch", [safeTarget("entity", de.name().value())],
          [ref(compArt, de.catalogLabel())],
          `domain entity "${de.name().value()}" is defined in no unit's entities.md — it was dropped on the way to functional design`);
      }
      // XS-3: 属性の取り落としは素描が自分で告げる（このユニットの定義に対してのみ）。
      if (input.unit !== undefined) {
        const mine = unitEntities.entityDeclaredIn(input.unit, key);
        if (mine) {
          const dropped = de.attributesDroppedIn(mine.attrs);
          if (dropped.length > 0) {
            ledger.finding("XS-3", "consistency-mismatch", [safeTarget("entity", de.name().value())],
              dropped.map((a) => ref(compArt, `entity ${de.name().value()}.attributes`, a)),
              `domain-design declares attribute(s) ${dropped.join(", ")} on "${de.name().value()}" that this unit's entities.md does not carry`);
          }
        }
      }
    }
    if (input.unit === undefined) {
      ledger.skip("XS-3", "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
    }
  }
}
