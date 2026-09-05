import { expect, test } from "bun:test";
import {
  AttributePath, BindingDeclaration, BindingValue, Declaration, DeclaredBindingValue, DeclaredBindings,
  EnumerationMember, EnumerationMembers, ErrorMessage, ErrorMessages, FunctionalRequirementReferences,
  RequirementIdentifier, ScenarioBinding, ScenarioBindings,
} from "@deep-spec/kernel-domain";
import { BusinessRuleReference, BusinessRuleReferences, InitialState, InitialStates, DesignWitness } from "@deep-spec/design-domain";
import { VerificationWitness } from "@deep-spec/requirements-domain";
import { IllegalArgumentException, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";

function collectionContract<E>(factory: { readonly name: string; of(values: readonly E[]): object; parse(values: readonly E[]): Result<object, ParseError> }, element: E, maximum: number): void {
  test(`${factory.name} exposes normal creation failure as ParseError and reconstruction failure as panic`, () => {
    expect(factory.parse([]).ok).toBe(true);
    expect(factory.parse([element]).ok).toBe(true);
    const oversized = Array.from({ length: maximum + 1 }, () => element);
    expect(() => factory.of(oversized)).toThrow(IllegalArgumentException);
    const parsed = factory.parse(oversized);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  });
}

collectionContract(ErrorMessages, ErrorMessage.of("failure"), 65_536);
collectionContract(FunctionalRequirementReferences, RequirementIdentifier.of("FR-1"), 10_000);
collectionContract(BusinessRuleReferences, BusinessRuleReference.of("BR1.1"), 10_000);
collectionContract(EnumerationMembers, EnumerationMember.of("open"), 10_000);
collectionContract(InitialStates, InitialState.of("open"), 10_000);
collectionContract(DeclaredBindings, BindingDeclaration.of(AttributePath.of("ticket.state"), DeclaredBindingValue.of(Declaration.of("open"))), 10_000);
collectionContract(ScenarioBindings, ScenarioBinding.of(AttributePath.of("ticket.state"), BindingValue.of("open")), 10_000);

test("duplicate bindings fail identically through the two construction interfaces", () => {
  const values = [ScenarioBinding.of(AttributePath.of("ticket.n"), BindingValue.of(1)), ScenarioBinding.of(AttributePath.of("ticket.n"), BindingValue.of(2))];
  expect(() => ScenarioBindings.of(values)).toThrow(IllegalArgumentException);
  expect(ScenarioBindings.parse(values)).toEqual({ ok: false, error: { kind: "duplicate-scenario-binding", raw: "ticket.n" } });
});

test("witnesses reject oversized structured input through parse as well as of", () => {
  const value = { model: { value: "x".repeat(65_537) } };
  for (const factory of [DesignWitness, VerificationWitness]) {
    expect(factory.parse({ model: { value: 1 } }).ok).toBe(true);
    expect(() => factory.of(value)).toThrow(IllegalArgumentException);
    const parsed = factory.parse(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
});
