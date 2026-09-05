import { describe, expect, test } from "bun:test";
import { type Result, IllegalArgumentException, parseConstruction } from "@deep-spec/kernel-infrastructure";
import {
  DesignAttributeName,
  UnmappedTargetRef,
  DesignEntityName,
  DesignTransitionId,
  LoweredOriginRef,
  DesignObligationId,
  DesignScenarioId,
  DesignMachineId,
  DesignBackgroundId,
  TransitionRef,
  LoweredId,
} from "@deep-spec/design-domain";
import {
  ObligationId,
  IrAttributeName,
  ScenarioId,
  BackgroundAssumptionId,
  IrEntityName,
} from "@deep-spec/requirements-domain";
import {
  CardinalityNotation,
  CheckFamily,
  ContractId,
  MachineSpec,
  NumericBound,
  LineNumber,
  RuleCategory,
  BusinessRuleId,
  SourceId,
  AttributeName,
  ElementPath,
  BlockIndex,
  StateName,
  TypeName,
  EntityName,
  ComponentName,
  AppliesTo,
  ReferenceTarget,
  AllowedValue,
} from "@deep-spec/refcheck-domain";
import {
  SkipReason,
  UnitName,
  ArtifactPath,
  FindingKind,
  ContentHash,
  IrVersion,
  BackendName,
  AttributePath,
  AttributeBound,
  VerificationMethod,
  TargetId,
  TriggerName,
  ErrorMessages,
} from "@deep-spec/kernel-domain";
import {
  PluginVersion,
} from "@deep-spec/doctor-domain";

// 同じ型の有効値・契約違反値を両方の生成口に渡す。型違反を作るキャストは使わない。
function contract<R extends string | number, V>(factory: {
  readonly name: string;
  of(raw: R): V;
  parse(raw: R): Result<V, IllegalArgumentException["problem"]>;
}, valid: R, invalid: R): void {
  test(`${factory.name}: of throws a contract violation, parse returns the same problem`, () => {
    expect(factory.parse(valid).ok).toBe(true);
    expect(() => factory.of(valid)).not.toThrow();
    const parsed = factory.parse(invalid);
    expect(parsed.ok).toBe(false);
    expect(() => factory.of(invalid)).toThrow(IllegalArgumentException);
    try {
      factory.of(invalid);
    } catch (error) {
      if (!(error instanceof IllegalArgumentException)) throw error;
      if (parsed.ok) throw new Error("invalid input unexpectedly parsed");
      expect(parsed.error).toEqual(error.problem);
    }
  });
}

describe("domain construction contracts", () => {
  contract(DesignAttributeName, "value", "");
  contract(UnmappedTargetRef, "value", "");
  contract(DesignEntityName, "value", "");
  contract(DesignTransitionId, "value", "");
  contract(LoweredOriginRef, "value", "");
  contract(DesignObligationId, "value", "");
  contract(DesignScenarioId, "value", "");
  contract(DesignMachineId, "value", "");
  contract(DesignBackgroundId, "value", "");
  contract(TransitionRef, "value", "");
  contract(LoweredId, "value", "");
  contract(ObligationId, "value", "");
  contract(IrAttributeName, "value", "");
  contract(ScenarioId, "value", "");
  contract(BackgroundAssumptionId, "value", "");
  contract(IrEntityName, "value", "");
  contract(CardinalityNotation, "value", "");
  contract(CheckFamily, "value", "");
  contract(ContractId, "value", "");
  contract(MachineSpec, "value", "");
  contract(NumericBound, 1, Number.POSITIVE_INFINITY);
  contract(LineNumber, 1, 0.5);
  contract(RuleCategory, "value", "");
  contract(BusinessRuleId, "BR1.1", "");
  contract(SourceId, "value", "");
  contract(AttributeName, "value", "");
  contract(ElementPath, "value", "");
  contract(BlockIndex, 1, 0.5);
  contract(StateName, "value", "");
  contract(TypeName, "value", "");
  contract(EntityName, "value", "");
  contract(ComponentName, "value", "");
  contract(AppliesTo, "value", "");
  contract(ReferenceTarget, "value", "");
  contract(AllowedValue, "value", "");
  contract(SkipReason, "timeout", "");
  contract(UnitName, "value", "");
  contract(ArtifactPath, "value", "");
  contract(FindingKind, "conflict", "");
  contract(ContentHash, "a".repeat(64), "");
  contract(IrVersion, "1.0.0", "");
  contract(BackendName, "value", "");
  contract(AttributePath, "value", "");
  contract(AttributeBound, 1, 0.5);
  contract(VerificationMethod, "exhaustive", "");
  contract(TargetId, "OB-1", "");
  contract(TriggerName, "value", "");
  contract(PluginVersion, "1.2.3", "1.2");

  test("parse does not swallow implementation defects", () => {
    for (const failure of [new Error("bug"), new TypeError("bug")]) {
      expect(() => parseConstruction(() => { throw failure; })).toThrow(failure);
    }
  });

  test("ErrorMessages accepts no errors and keeps its snapshot immutable", () => {
    const empty = ErrorMessages.of([]);
    expect(empty.isEmpty()).toBe(true);
    const source = ["first"];
    const messages = ErrorMessages.of(source);
    source.push("outside");
    expect(messages.toArray()).toEqual(["first"]);
    expect(Object.isFrozen(messages.toArray())).toBe(true);
    expect(messages.add("second").toArray()).toEqual(["first", "second"]);
    expect(messages.toArray()).toEqual(["first"]);
  });
});
