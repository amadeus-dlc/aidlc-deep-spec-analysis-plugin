import { expect, test } from "bun:test";
import { KeyedIndex, NormalizedName, UnitName } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import {
  AttributeDeclaration,
  AttributeDeclarations,
  AttributeName,
  ElementPath,
  EntityDeclaration,
  EntityDeclarations,
  EntityName,
  RelationshipDeclarations,
  SiblingUnitIndex,
} from "@deep-spec-analysis/refcheck-domain";

const attribute = AttributeDeclaration.of({
  name: AttributeName.of("qty"),
  element: ElementPath.of("Order.qty"),
  type: null,
  uniqueIsTrue: false,
  references: null,
  allowed: null,
  def: null,
  minDeclared: false,
  maxDeclared: false,
  min: null,
  max: null,
});
const entity = EntityDeclaration.of({
  name: EntityName.of("Order"),
  element: ElementPath.of("Order"),
  attrs: AttributeDeclarations.of([attribute]),
  rels: RelationshipDeclarations.of([]),
});
const unit = UnitName.of("u1");
const order = NormalizedName.of("Order");

test("兄弟ユニットの索引は構築後に呼出元の入力を変更しても変化しない", () => {
  const entities = [entity];
  const declarations = EntityDeclarations.of(entities);
  const entries: (readonly [UnitName, EntityDeclarations])[] = [[unit, declarations]];
  const index = SiblingUnitIndex.of(KeyedIndex.of(entries));
  entries.splice(0);
  entities.splice(0);
  expect(
    index
      .definersOf(order)
      .toArray()
      .map((name) => name.asString()),
  ).toEqual(["u1"]);
  const returned = index.entityDeclaredIn(unit, order);
  expect(
    returned
      ?.attrs()
      .names()
      .map((name) => name.asString()),
  ).toEqual(["qty"]);
  returned?.attrs().add(attribute);
  expect(
    index
      .entityDeclaredIn(unit, order)
      ?.attrs()
      .names()
      .map((name) => name.asString()),
  ).toEqual(["qty"]);
});

test("XSの走査予算違反はofで例外、parseで非例外のParseErrorになる", () => {
  const input = KeyedIndex.of([[unit, EntityDeclarations.of(Array.from({ length: 65_537 }, () => entity))]]);
  expect(() => SiblingUnitIndex.of(input)).toThrow(IllegalArgumentException);
  const parsed = SiblingUnitIndex.parse(input);
  expect(parsed).toEqual({ ok: false, error: { kind: "too-many-sibling-entities", raw: 65_537 } });
  if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
});
