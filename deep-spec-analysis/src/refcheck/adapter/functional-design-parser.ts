import { FenceCount } from "@deep-spec-analysis/refcheck-domain";

// functional-design三点セットとXS用components.mdのfence・YAML・Jsonを解析し、
// 型付き宣言と解析結果へ変換する。宣言間の意味的な整合性はドメインが検査する。

import { extractFences, parseRequirementIdentifiers, parseYamlSubset } from "@deep-spec-analysis/kernel-adapter";
import { ErrorMessage, KeyedIndex, UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  combineResults,
  err,
  isObject,
  type Json,
  ok,
  type ParseError,
  type Result,
  traverseResult,
} from "@deep-spec-analysis/kernel-infrastructure";

import {
  AllowedValue,
  AllowedValues,
  AppliesTo,
  AttributeDeclaration,
  AttributeDeclarations,
  AttributeDefault,
  AttributeName,
  AttributeNames,
  CardinalityNotation,
  ComponentName,
  DeclaredEntities,
  DeclaredRuleIdentifier,
  DomainEntitiesOutcome,
  DomainEntitySketch,
  DomainEntitySketches,
  ElementPath,
  EntitiesOutcome,
  EntityDeclaration,
  EntityDeclarations,
  EntityName,
  FunctionalSpecificationOutcome,
  LineNumber,
  MachineSpecification,
  NumericBound,
  ReferenceTarget,
  RelationshipDeclaration,
  RelationshipDeclarations,
  RuleCategory,
  RuleDeclaration,
  RuleDeclarations,
  RulesOutcome,
  ShapeError,
  ShapeErrors,
  SiblingUnitIndex,
  SourceIdentifier,
  SourceIdentifiers,
  StateMachineSketch,
  StateMachineSketches,
  StateName,
  StateNames,
  TypeName,
} from "@deep-spec-analysis/refcheck-domain";

function str(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

function pick(v: { [k: string]: Json }, keys: string[]): Json {
  for (const k of keys) {
    if (k in v) return v[k] as Json;
  }
  return null;
}

function extractRel(
  raw: Json,
  element: string,
  implicitFrom: string | null,
): Result<RelationshipDeclaration | null, string> {
  if (!isObject(raw)) return ok(null);
  const from = str(pick(raw, ["from", "source"])) ?? implicitFrom;
  const to = str(pick(raw, ["to", "target", "entity"]));
  const cardinality = str(pick(raw, ["cardinality"]));
  const hasDirection = (from !== null && to !== null) || str(pick(raw, ["direction"])) !== null;
  const fields = combineResults({
    from: from === null ? ok(null) : EntityName.parse(from),
    to: to === null ? ok(null) : EntityName.parse(to),
    cardinality: cardinality === null ? ok(null) : CardinalityNotation.parse(cardinality),
  });
  if (!fields.ok) return err(JSON.stringify(fields.error));
  return ok(
    RelationshipDeclaration.of({
      element: ElementPath.of(element),
      from: fields.value.from,
      to: fields.value.to,
      cardinality: fields.value.cardinality,
      hasDirection,
    }),
  );
}

function extractEntities(value: Json): Result<DeclaredEntities, string> {
  const collected: { entities: EntityDeclaration[]; rels: RelationshipDeclaration[]; shapeErrors: ShapeError[] } = {
    entities: [],
    rels: [],
    shapeErrors: [],
  };
  const model = collected;
  if (!isObject(value) || !Array.isArray(value.entities)) {
    model.shapeErrors.push(
      ShapeError.of({ element: ElementPath.of("entities"), detail: "top-level `entities:` list is missing" }),
    );
    const parsed = combineResults({
      entities: EntityDeclarations.parse(collected.entities),
      rels: RelationshipDeclarations.parse(collected.rels),
      shapeErrors: ShapeErrors.parse(collected.shapeErrors),
    });
    return parsed.ok ? ok(DeclaredEntities.of(parsed.value)) : err(JSON.stringify(parsed.error));
  }
  for (const [i, raw] of value.entities.entries()) {
    const element = `entities[${i}]`;
    if (!isObject(raw)) {
      model.shapeErrors.push(
        ShapeError.of({ element: ElementPath.of(element), detail: "entity entry is not a mapping" }),
      );
      continue;
    }
    const name = str(raw.name);
    if (name === null) {
      model.shapeErrors.push(
        ShapeError.of({ element: ElementPath.of(`${element}.name`), detail: "entity has no string `name`" }),
      );
      continue;
    }
    const entity = EntityName.parse(name);
    if (!entity.ok) {
      model.shapeErrors.push(
        ShapeError.of({ element: ElementPath.of(`${element}.name`), detail: JSON.stringify(entity.error) }),
      );
      continue;
    }
    const attrs: AttributeDeclaration[] = [];
    let collectionError: string | null = null;
    if (Array.isArray(raw.attributes)) {
      (raw.attributes as Json[]).forEach((a, j) => {
        const ael = `${element}.attributes[${j}]`;
        if (!isObject(a)) {
          model.shapeErrors.push(
            ShapeError.of({ element: ElementPath.of(ael), detail: "attribute entry is not a mapping" }),
          );
          return;
        }
        const aname = str(a.name);
        if (aname === null) {
          model.shapeErrors.push(
            ShapeError.of({ element: ElementPath.of(`${ael}.name`), detail: "attribute has no string `name`" }),
          );
          return;
        }
        const type = str(pick(a, ["type", "logical_type", "logical-type"]));
        if (type === null) {
          model.shapeErrors.push(
            ShapeError.of({
              element: ElementPath.of(`${ael}.type`),
              detail: `attribute "${name}.${aname}" has no logical type`,
            }),
          );
        }
        const allowedRaw = pick(a, ["allowed_values", "allowed-values", "allowed", "values"]);
        const allowed = Array.isArray(allowedRaw)
          ? (allowedRaw as Json[]).map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
          : null;
        const defRaw = pick(a, ["default"]);
        const minRaw = pick(a, ["min"]);
        const maxRaw = pick(a, ["max"]);
        const references = str(pick(a, ["references", "reference", "ref"]));
        const fields = combineResults({
          name: AttributeName.parse(aname),
          def: typeof defRaw === "number" || typeof defRaw === "string" ? AttributeDefault.parse(defRaw) : ok(null),
          type: type === null ? ok(null) : TypeName.parse(type),
          references: references === null ? ok(null) : ReferenceTarget.parse(references),
          allowed: allowed === null ? ok(null) : traverseResult(allowed, AllowedValue.parse),
          min: typeof minRaw === "number" ? NumericBound.parse(minRaw) : ok(null),
          max: typeof maxRaw === "number" ? NumericBound.parse(maxRaw) : ok(null),
        });
        if (!fields.ok) {
          model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(ael), detail: JSON.stringify(fields.error) }));
          return;
        }
        const parsedAllowed = fields.value.allowed === null ? null : AllowedValues.parse(fields.value.allowed);
        if (parsedAllowed !== null && !parsedAllowed.ok) {
          collectionError = JSON.stringify(parsedAllowed.error);
          return;
        }
        attrs.push(
          AttributeDeclaration.of({
            name: fields.value.name,
            element: ElementPath.of(ael),
            type: fields.value.type,
            uniqueIsTrue: pick(a, ["unique"]) === true,
            references: fields.value.references,
            allowed: parsedAllowed === null ? null : parsedAllowed.value,
            def: fields.value.def,
            minDeclared: minRaw !== null,
            maxDeclared: maxRaw !== null,
            min: fields.value.min,
            max: fields.value.max,
          }),
        );
      });
    }
    if (collectionError !== null) return err(collectionError);
    const rels: RelationshipDeclaration[] = [];
    if (Array.isArray(raw.relationships)) {
      (raw.relationships as Json[]).forEach((r, j) => {
        const rel = extractRel(r, `${element}.relationships[${j}]`, name);
        if (!rel.ok)
          model.shapeErrors.push(
            ShapeError.of({ element: ElementPath.of(`${element}.relationships[${j}]`), detail: rel.error }),
          );
        else if (rel.value !== null) rels.push(rel.value);
      });
    }
    const parsedAttributes = AttributeDeclarations.parse(attrs);
    if (!parsedAttributes.ok) return err(JSON.stringify(parsedAttributes.error));
    const parsedRelationships = RelationshipDeclarations.parse(rels);
    if (!parsedRelationships.ok) return err(JSON.stringify(parsedRelationships.error));
    model.entities.push(
      EntityDeclaration.of({
        name: entity.value,
        element: ElementPath.of(element),
        attrs: parsedAttributes.value,
        rels: parsedRelationships.value,
      }),
    );
  }
  if (Array.isArray(value.relationships)) {
    (value.relationships as Json[]).forEach((r, j) => {
      const rel = extractRel(r, `relationships[${j}]`, null);
      if (!rel.ok)
        model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`relationships[${j}]`), detail: rel.error }));
      else if (rel.value !== null) model.rels.push(rel.value);
    });
  }
  const parsed = combineResults({
    entities: EntityDeclarations.parse(collected.entities),
    rels: RelationshipDeclarations.parse(collected.rels),
    shapeErrors: ShapeErrors.parse(collected.shapeErrors),
  });
  return parsed.ok ? ok(DeclaredEntities.of(parsed.value)) : err(JSON.stringify(parsed.error));
}

export function parseEntitiesDocument(md: string | null): EntitiesOutcome {
  if (md === null) return EntitiesOutcome.absent();
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1) return EntitiesOutcome.wrongFenceCount(FenceCount.of(fences.length));
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return EntitiesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const extracted = extractEntities(parsed.value ?? null);
  return extracted.ok
    ? EntitiesOutcome.extracted(extracted.value)
    : EntitiesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), extracted.error);
}

export function parseRulesDocument(md: string | null): RulesOutcome {
  if (md === null) return RulesOutcome.absent();
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1) return RulesOutcome.wrongFenceCount(FenceCount.of(fences.length));
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const v = parsed.value ?? null;
  if (!isObject(v) || !Array.isArray(v.rules)) return RulesOutcome.noRulesList();
  let collectionError: string | null = null;
  const ruleList: RuleDeclaration[] = (v.rules as Json[]).map((raw, i) => {
    const element = `rules[${i}]`;
    if (!isObject(raw)) {
      return RuleDeclaration.of({
        id: null,
        element: ElementPath.of(element),
        category: null,
        appliesTo: null,
        sourceIds: SourceIdentifiers.of([]),
        missing: ["<entry is not a mapping>"],
      });
    }
    const missing = ["id", "statement", "category"].filter((k) => !(k in raw));
    if (!("source" in raw) && !("sources" in raw)) missing.push("source");
    const source = pick(raw, ["source", "sources"]);
    const sourceText = Array.isArray(source)
      ? (source as Json[]).filter((s): s is string => typeof s === "string").join(" ")
      : (str(source) ?? "");
    const id = str(raw.id);
    const category = str(raw.category);
    const appliesTo = str(pick(raw, ["applies_to", "applies-to", "applies to", "appliesTo"]));
    const parsedId = id === null ? ok(null) : DeclaredRuleIdentifier.parse(id);
    if (!parsedId.ok) missing.push("id");
    const parsedCategory = category === null ? ok(null) : RuleCategory.parse(category);
    const parsedAppliesTo = appliesTo === null ? ok(null) : AppliesTo.parse(appliesTo);
    if (!parsedCategory.ok) missing.push("category");
    if (!parsedAppliesTo.ok) missing.push("applies_to");
    const parsedRequirementIds = parseRequirementIdentifiers(sourceText);
    let sourceIds: SourceIdentifiers;
    if (!parsedRequirementIds.ok) {
      collectionError = JSON.stringify(parsedRequirementIds.error);
      sourceIds = SourceIdentifiers.of([]);
    } else {
      const parsedSourceIds = SourceIdentifiers.parse(
        [...parsedRequirementIds.value].map((value) => SourceIdentifier.of(value.asString())),
      );
      if (!parsedSourceIds.ok) {
        collectionError = JSON.stringify(parsedSourceIds.error);
        sourceIds = SourceIdentifiers.of([]);
      } else {
        sourceIds = parsedSourceIds.value;
      }
    }
    return RuleDeclaration.of({
      id: parsedId.ok ? parsedId.value : null,
      element: ElementPath.of(element),
      category: parsedCategory.ok ? parsedCategory.value : null,
      appliesTo: parsedAppliesTo.ok ? parsedAppliesTo.value : null,
      sourceIds,
      missing,
    });
  });
  if (collectionError !== null) return RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), collectionError);
  const parsedRules = RuleDeclarations.parse(ruleList);
  return parsedRules.ok
    ? RulesOutcome.extracted(parsedRules.value)
    : RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), JSON.stringify(parsedRules.error));
}

export function parseFunctionalSpecDocument(md: string | null): FunctionalSpecificationOutcome {
  if (md === null) return FunctionalSpecificationOutcome.absent();
  const machines: StateMachineSketch[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = (lines[i] ?? "").match(/^#{2,4}\s+State Machine:\s*(.*?)\s*$/i);
    if (!h) continue;
    const spec = MachineSpecification.parse((h[1] ?? "").trim());
    if (!spec.ok) {
      machines.push(
        StateMachineSketch.unrecognized(
          LineNumber.of(i + 1),
          ErrorMessage.of(`invalid state machine specification: ${spec.error.kind}`),
        ),
      );
      continue;
    }
    // Find the next mermaid fence before the next heading of same/higher level.
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,4}\s/.test(lines[j] ?? "")) break;
      const f = (lines[j] ?? "").match(/^\s*```\s*mermaid\s*$/i);
      if (!f) continue;
      const body: string[] = [];
      let k = j + 1;
      while (k < lines.length && !/^\s*```\s*$/.test(lines[k] ?? "")) {
        body.push(lines[k] ?? "");
        k++;
      }
      const text = body.join("\n");
      if (!/stateDiagram/i.test(text)) break;
      let unsupported: string | null = null;
      if (/\{/.test(text)) unsupported = "composite states are outside the supported stateDiagram subset";
      if (/<<choice>>|<<fork>>|<<join>>/.test(text))
        unsupported = "choice/fork/join nodes are outside the supported stateDiagram subset";
      const states = new Set<string>();
      for (const line of body) {
        const t = (line ?? "").trim();
        const m = t.match(/^(\[?\*?\]?[\w-]*)\s*-->\s*([\w-]+)/);
        if (m) {
          for (const s of [m[1] ?? "", m[2] ?? ""]) {
            if (s !== "" && s !== "[*]" && !s.startsWith("[")) states.add(s);
          }
        }
      }
      const parsedStates = traverseResult([...states].sort(), StateName.parse);
      if (!parsedStates.ok) {
        machines.push(
          StateMachineSketch.unrecognized(
            LineNumber.of(j + 1),
            ErrorMessage.of(`invalid diagram state: ${parsedStates.error.kind}`),
          ),
        );
        break;
      }
      const stateNames = StateNames.parse(parsedStates.value);
      if (!stateNames.ok) {
        machines.push(
          StateMachineSketch.unrecognized(
            LineNumber.of(j + 1),
            ErrorMessage.of(`state collection is too large: ${stateNames.error.kind}`),
          ),
        );
        break;
      }
      machines.push(
        StateMachineSketch.of({
          spec: spec.value,
          states: stateNames.value,
          fenceLine: LineNumber.of(j + 1),
          unsupported,
        }),
      );
      break;
    }
  }
  return FunctionalSpecificationOutcome.present(StateMachineSketches.of(machines));
}

export function parseDomainEntitiesDocument(md: string | null): DomainEntitiesOutcome {
  if (md === null) return DomainEntitiesOutcome.absent();
  const compFence = extractFences(md, "yaml")[0];
  const parsed = compFence === undefined ? { error: "no yaml fence" } : parseYamlSubset(compFence.body);
  if (parsed.error !== undefined) return DomainEntitiesOutcome.unusable(parsed.error);
  const value = "value" in parsed ? (parsed.value ?? null) : null;
  const out: DomainEntitySketch[] = [];
  if (isObject(value) && Array.isArray(value.components)) {
    for (const raw of value.components as Json[]) {
      if (!isObject(raw) || typeof raw.name !== "string") continue;
      if (!Array.isArray(raw.entities)) continue;
      for (const e of raw.entities as Json[]) {
        if (!isObject(e) || typeof e.name !== "string") continue;
        const attributes = Array.isArray(e.attributes)
          ? (e.attributes as Json[]).filter((a): a is string => typeof a === "string")
          : [];
        const fields = combineResults({
          name: EntityName.parse(e.name),
          component: ComponentName.parse(raw.name),
          attributes: traverseResult(attributes, AttributeName.parse),
        });
        if (!fields.ok) return DomainEntitiesOutcome.unusable(JSON.stringify(fields.error));
        const parsedAttributes = AttributeNames.parse(fields.value.attributes);
        if (!parsedAttributes.ok) return DomainEntitiesOutcome.unusable(JSON.stringify(parsedAttributes.error));
        out.push(
          DomainEntitySketch.of({
            name: fields.value.name,
            component: fields.value.component,
            attributes: parsedAttributes.value,
          }),
        );
      }
    }
  }
  const parsedEntities = DomainEntitySketches.parse(out);
  return parsedEntities.ok
    ? DomainEntitiesOutcome.extracted(parsedEntities.value)
    : DomainEntitiesOutcome.unusable(JSON.stringify(parsedEntities.error));
}

// 兄弟ユニットの entities.md 群を XS 用の索引へ。fence 無し・解析不能な
// ユニットは黙って除外する（そのユニット自身の実行が解析エラーを報告する）。
export function buildSiblingUnitEntities(
  texts: readonly { unit: string; text: string }[],
): Result<SiblingUnitIndex, ParseError> {
  const unitEntities: (readonly [UnitName, EntityDeclarations])[] = [];
  for (const { unit, text } of texts) {
    const fence = extractFences(text, "yaml")[0];
    if (fence === undefined) continue;
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) continue; // its own unit's run reports the parse error
    const model = extractEntities(parsed.value ?? null);
    if (!model.ok) return err({ kind: "invalid-entities", raw: model.error });
    const name = UnitName.parse(unit);
    if (!name.ok) return name;
    unitEntities.push([name.value, model.value.entities()]);
  }
  return SiblingUnitIndex.parse(KeyedIndex.of(unitEntities));
}
