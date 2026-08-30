// FD/XS 検査ファミリー — 型付き入力上の純検査。
// finding/skip の文言・targets・witness refs・skip の発行順は旧センサー本体
// からの逐語移動（golden バイト凍結。並びはソートで正規化されるが、tie の
// 挙動まで変えないため発行順も保存する）。

import { normalizeName, safeTarget } from "../../kernel/domain/index.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import type {
  AttrDecl,
  DomainEntitiesOutcome,
  EntitiesModel,
  EntitiesOutcome,
  EntityDecl,
  FunctionalSpecOutcome,
  RuleDecl,
  RulesOutcome,
  SiblingUnitEntities,
} from "./functional-design.ts";
import type { RefEntry } from "./ref-entry.ts";

export const FUNCTIONAL_FAMILIES = [
  "FD-E1", "FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6",
  "FD-R1", "FD-R2", "FD-R3", "FD-R4", "FD-R5",
  "FD-S1", "FD-S2",
  "XS-1", "XS-2", "XS-3",
];
const CARDINALITIES = new Set(["1:1", "1:N", "N:1", "N:M"]);
const CATEGORIES = new Set(["validation", "authorization", "constraint", "calculation", "policy"]);
const NUMERICISH = new Set(["int", "integer", "number", "decimal", "float", "double", "long"]);
const DATEISH = new Set(["date", "datetime", "timestamp", "time"]);
const BOOLISH = new Set(["bool", "boolean"]);
const COLLECTIONISH = new Set(["list", "array", "map", "object", "collection", "set"]);

export interface FunctionalChecksInput {
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
  readonly siblingUnits: SiblingUnitEntities;
}

function ref(artifact: string, element: string, value?: string): RefEntry {
  return value === undefined ? { artifact, element } : { artifact, element, value };
}

function lifecycleAttrOf(e: EntityDecl): AttrDecl | null {
  const named = e.attrs.find((a) => (a.name.value() === "status" || a.name.value() === "state") && a.allowed !== null);
  if (named) return named;
  const withAllowed = e.attrs.filter((a) => a.allowed !== null);
  return withAllowed.length === 1 ? (withAllowed[0] ?? null) : null;
}

export function runFunctionalChecks(input: FunctionalChecksInput, ledger: CheckFamilyLedger): void {
  const entitiesArt = input.entitiesArtifact;

  // --- entities.md ----------------------------------------------------------
  let entities: EntitiesModel | null = null;
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
    for (const e of entities.shapeErrors) {
      ledger.finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, e.element.value())], e.detail);
    }
    const seenEntities = new Set<string>();
    for (const e of entities.entities) {
      if (seenEntities.has(e.name.value())) {
        ledger.finding("FD-E1", "structure-invalid", [safeTarget("entity", e.name.value())], [ref(entitiesArt, `${e.element.value()}.name`, e.name.value())],
          `entity "${e.name.value()}" is declared more than once`);
      }
      seenEntities.add(e.name.value());
      const seenAttrs = new Set<string>();
      for (const a of e.attrs) {
        if (seenAttrs.has(a.name.value())) {
          ledger.finding("FD-E1", "structure-invalid", [safeTarget("attr", `${e.name.value()}.${a.name.value()}`)], [ref(entitiesArt, `${a.element.value()}.name`, a.name.value())],
            `attribute "${e.name.value()}.${a.name.value()}" is declared more than once`);
        }
        seenAttrs.add(a.name.value());
      }
    }
  }

  if (entities !== null) {
    const declaredEntities = new Set(entities.entities.map((e) => e.name.value()));
    for (const e of entities.entities) {
      for (const a of e.attrs) {
        const t = a.type === null ? "" : a.type.normalized();
        const attrId = safeTarget("attr", `${e.name.value()}.${a.name.value()}`);
        // FD-E2: type-token coherence
        if (a.allowed !== null && (NUMERICISH.has(t) || DATEISH.has(t) || BOOLISH.has(t))) {
          ledger.finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), t)],
            `"${e.name.value()}.${a.name.value()}" declares allowed values but its type "${a.type === null ? "null" : a.type.value()}" is not an enumerable type`);
        }
        if ((a.minDeclared || a.maxDeclared) && t !== "" && !NUMERICISH.has(t) && !DATEISH.has(t)) {
          ledger.finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), t)],
            `"${e.name.value()}.${a.name.value()}" declares min/max but its type "${a.type === null ? "null" : a.type.value()}" is not numeric or date-like`);
        }
        if (a.uniqueIsTrue && COLLECTIONISH.has(t)) {
          ledger.finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), t)],
            `"${e.name.value()}.${a.name.value()}" declares unique but its type "${a.type === null ? "null" : a.type.value()}" is not scalar`);
        }
        // FD-E3: range/default coherence
        if (a.min !== null && a.max !== null && a.min.value() > a.max.value()) {
          ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), `min ${a.min.value()} > max ${a.max.value()}`)],
            `"${e.name.value()}.${a.name.value()}": min ${a.min.value()} exceeds max ${a.max.value()}`);
        }
        if (a.def !== null && a.def.isNumber()) {
          if (a.min !== null && a.def.asNumber() < a.min.value()) {
            ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), a.def.render())],
              `"${e.name.value()}.${a.name.value()}": default ${a.def.render()} is below min ${a.min.value()}`);
          }
          if (a.max !== null && a.def.asNumber() > a.max.value()) {
            ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), a.def.render())],
              `"${e.name.value()}.${a.name.value()}": default ${a.def.render()} is above max ${a.max.value()}`);
          }
        }
        if (a.allowed !== null && a.def !== null && a.def.isString() && !a.allowed.some((v) => v.value() === a.def?.asString())) {
          ledger.finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element.value(), a.def.render())],
            `"${e.name.value()}.${a.name.value()}": default "${a.def.render()}" is not one of the allowed values`);
        }
        // FD-E6: attribute references resolve
        if (a.references !== null) {
          const token = a.references.value().match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.[A-Za-z][A-Za-z0-9_]*)?$/);
          const target = token ? (token[1] ?? "") : "";
          const resolves = token
            ? declaredEntities.has(target)
            : entities.entities.some((d) => a.references !== null && a.references.value().toLowerCase().includes(d.name.value().toLowerCase()));
          if (!resolves) {
            ledger.finding("FD-E6", "reference-broken", [attrId], [ref(entitiesArt, a.element.value(), a.references.value())],
              `"${e.name.value()}.${a.name.value()}" references "${a.references.value()}" which is not a declared entity`);
          }
        }
      }
    }
    // FD-E4 / FD-E5: relationships
    const allRels = [...entities.rels, ...entities.entities.flatMap((e) => e.rels)];
    for (const r of allRels) {
      for (const endpoint of [r.from, r.to]) {
        if (endpoint !== null && !declaredEntities.has(endpoint.value())) {
          ledger.finding("FD-E4", "reference-broken", [safeTarget("entity", endpoint.value())], [ref(entitiesArt, r.element.value(), endpoint.value())],
            `relationship endpoint "${endpoint.value()}" is not a declared entity`);
        }
      }
      if (r.cardinality !== null) {
        const token = r.cardinality.normalizedToken();
        if (!CARDINALITIES.has(token)) {
          ledger.finding("FD-E5", "structure-invalid", ["check:FD-E5"], [ref(entitiesArt, r.element.value(), r.cardinality.value())],
            `cardinality "${r.cardinality.value()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
        }
        if (!r.hasDirection) {
          ledger.finding("FD-E5", "structure-invalid", ["check:FD-E5"], [ref(entitiesArt, r.element.value())],
            "relationship declares a cardinality but no direction (from/to or direction key)");
        }
      }
    }
  }

  // --- rules.md -------------------------------------------------------------
  const rulesArt = input.rulesArtifact;
  let rules: readonly RuleDecl[] | null = null;
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
      if (r.missing.length > 0) {
        ledger.finding("FD-R1", "structure-invalid", [r.id !== null && r.id.matchesShape() ? r.id.value() : "check:FD-R1"],
          [ref(rulesArt, r.element.value())],
          `rule is missing required key(s): ${r.missing.join(", ")}`);
      }
    }
  }

  if (rules !== null) {
    // FD-R2: id shape + uniqueness
    const seenIds = new Set<string>();
    for (const r of rules) {
      if (r.id === null) continue;
      if (!r.id.matchesShape()) {
        ledger.finding("FD-R2", "structure-invalid", ["check:FD-R2"], [ref(rulesArt, `${r.element.value()}.id`, r.id.value())],
          `rule id "${r.id.value()}" does not match BR{group}.{seq}`);
        continue;
      }
      if (seenIds.has(r.id.value())) {
        ledger.finding("FD-R2", "structure-invalid", [r.id.value()], [ref(rulesArt, `${r.element.value()}.id`, r.id.value())],
          `rule id "${r.id.value()}" is declared more than once`);
      }
      seenIds.add(r.id.value());
    }
    // FD-R3: source FR/NFR ids exist in requirements.md
    if (input.requirementIdsKnown === null) {
      ledger.skip("FD-R3", "absent-input", "requirements.md not found under this intent record — source ids cannot be reverse-verified");
    } else {
      const known = input.requirementIdsKnown;
      for (const r of rules) {
        const missing = r.sourceIds.map((id) => id.value()).filter((id) => !known.has(id)).sort();
        if (missing.length > 0) {
          ledger.finding("FD-R3", "reference-broken",
            [r.id !== null && r.id.matchesShape() ? r.id.value() : "check:FD-R3"],
            missing.map((id) => ref(rulesArt, `${r.element.value()}.source`, id)),
            `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
        }
      }
    }
    // FD-R4: applies-to resolves against entities.md
    if (entities === null) {
      ledger.skip("FD-R4", "absent-input", "entities.md is unavailable — applies-to cannot be resolved");
    } else {
      const declaredEntities = entities.entities;
      for (const r of rules) {
        if (r.appliesTo === null) continue;
        const appliesToValue = r.appliesTo.value();
        const token = appliesToValue.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
        let resolves: boolean;
        if (token) {
          const ent = declaredEntities.find((e) => e.name.value() === token[1]);
          resolves = ent !== undefined && (token[2] === undefined || ent.attrs.some((a) => a.name.value() === token[2]));
        } else {
          resolves = declaredEntities.some((e) => appliesToValue.toLowerCase().includes(e.name.value().toLowerCase()));
        }
        if (!resolves) {
          ledger.finding("FD-R4", "reference-broken",
            [r.id !== null && r.id.matchesShape() ? r.id.value() : "check:FD-R4"],
            [ref(rulesArt, r.element.value(), appliesToValue)],
            `applies-to "${appliesToValue}" does not resolve to a declared entity or entity.attribute`);
        }
      }
    }
    // FD-R5: category closed set
    for (const r of rules) {
      if (r.category !== null && !CATEGORIES.has(r.category.normalized())) {
        ledger.finding("FD-R5", "structure-invalid",
          [r.id !== null && r.id.matchesShape() ? r.id.value() : "check:FD-R5"],
          [ref(rulesArt, `${r.element.value()}.category`, r.category.value())],
          `category "${r.category.value()}" is not one of validation | authorization | constraint | calculation | policy`);
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
    if (machines.length === 0) {
      const lifecycle = entities.entities.filter((e) => lifecycleAttrOf(e) !== null);
      for (const e of lifecycle) {
        ledger.skip("FD-S1", "unrecognized-format",
          `no \`### State Machine: ${e.name.value()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name.value()}"`);
        ledger.skip("FD-S2", "unrecognized-format",
          `no \`### State Machine: ${e.name.value()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name.value()}"`);
      }
    }
    for (const m of machines) {
      const entName = m.spec.entityToken();
      const attrName = m.spec.attributeToken();
      const el = `State Machine: ${m.spec.value()} (fence line ${m.fenceLine})`;
      if (m.unsupported !== null) {
        ledger.skip("FD-S1", "unrecognized-format", `${el}: ${m.unsupported}`);
        ledger.skip("FD-S2", "unrecognized-format", `${el}: ${m.unsupported}`);
        continue;
      }
      const ent = entities.entities.find((e) => e.name.normalized() === normalizeName(entName));
      if (!ent) {
        ledger.finding("FD-S1", "consistency-mismatch", [safeTarget("entity", entName)], [ref(specArt, el, entName)],
          `state machine names entity "${entName}" which is not declared in entities.md`);
        continue;
      }
      const attr = attrName !== undefined
        ? (ent.attrs.find((a) => a.name.value() === attrName) ?? null)
        : lifecycleAttrOf(ent);
      if (!attr || attr.allowed === null) {
        ledger.skip("FD-S1", "unrecognized-format",
          `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name.value()}"`);
        ledger.skip("FD-S2", "unrecognized-format",
          `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name.value()}"`);
        continue;
      }
      const attrId = safeTarget("attr", `${ent.name.value()}.${attr.name.value()}`);
      const allowedNorm = new Set(attr.allowed.map((v) => v.normalized()));
      const stateNorm = new Set(m.states.map((s) => s.normalized()));
      const rogue = m.states.filter((s) => !allowedNorm.has(s.normalized())).map((s) => s.value()).sort();
      if (rogue.length > 0) {
        ledger.finding("FD-S1", "consistency-mismatch", [attrId],
          rogue.map((s) => ref(specArt, el, s)),
          `diagram state(s) ${rogue.join(", ")} are not allowed values of ${ent.name.value()}.${attr.name.value()} in entities.md`);
      }
      const dangling = attr.allowed.filter((v) => !stateNorm.has(v.normalized())).map((v) => v.value()).sort();
      if (dangling.length > 0) {
        ledger.finding("FD-S2", "consistency-mismatch", [attrId],
          dangling.map((v) => ref(entitiesArt, attr.element.value(), v)),
          `allowed value(s) ${dangling.join(", ")} of ${ent.name.value()}.${attr.name.value()} appear in no diagram state`);
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
    // Dedupe by normalized name: a doubly-declared domain entity is DD-5's
    // finding; the XS checks look at each distinct entity once.
    const seenDomain = new Set<string>();
    for (const de of [...domainEntities].sort((a, b) => (a.name.value() < b.name.value() ? -1 : 1))) {
      const key = de.name.normalized();
      if (seenDomain.has(key)) continue;
      seenDomain.add(key);
      const definers = [...unitEntities.entries()].filter(([, m]) => m.has(key)).map(([u]) => u);
      if (definers.length >= 2) {
        ledger.finding("XS-1", "consistency-mismatch", [safeTarget("entity", de.name.value())],
          [ref(compArt, `entity ${de.name.value()} (component ${de.component.value()})`),
            ...definers.map((u) => ref(`construction/${u}/functional-design/entities.md`, `entity ${de.name.value()}`))],
          `domain entity "${de.name.value()}" is defined in ${definers.length} units (${definers.join(", ")}) — ownership is duplicated`);
      } else if (definers.length === 0 && unitEntities.size > 0) {
        ledger.finding("XS-2", "consistency-mismatch", [safeTarget("entity", de.name.value())],
          [ref(compArt, `entity ${de.name.value()} (component ${de.component.value()})`)],
          `domain entity "${de.name.value()}" is defined in no unit's entities.md — it was dropped on the way to functional design`);
      }
      // XS-3: attribute drift, for THIS unit's definition only.
      if (input.unit !== undefined) {
        const mine = unitEntities.get(input.unit)?.get(key);
        if (mine) {
          const mineNorm = new Set(mine.attrs.map((a) => a.normalized()));
          const dropped = de.attributes.filter((a) => !mineNorm.has(a.normalized())).map((a) => a.value()).sort();
          if (dropped.length > 0) {
            ledger.finding("XS-3", "consistency-mismatch", [safeTarget("entity", de.name.value())],
              dropped.map((a) => ref(compArt, `entity ${de.name.value()}.attributes`, a)),
              `domain-design declares attribute(s) ${dropped.join(", ")} on "${de.name.value()}" that this unit's entities.md does not carry`);
          }
        }
      }
    }
    if (input.unit === undefined) {
      ledger.skip("XS-3", "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
    }
  }
}
