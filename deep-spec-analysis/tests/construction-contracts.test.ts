import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { ErrorMessage } from "@deep-spec/kernel-domain";
import { describe, expect, test } from "bun:test";
import { type Result, IllegalArgumentException, parseConstruction } from "@deep-spec/kernel-infrastructure";
import {
  DesignUnitId,
  BrRef,
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
  FenceCount,
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
  QueryLabel,
  RequirementId,
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
  parse(raw: R): Result<V, ParseError>;
}, valid: R, invalid: R): void {
  test(`${factory.name}: of panics, parse returns a non-exception ParseError`, () => {
    expect(factory.parse(valid).ok).toBe(true);
    expect(() => factory.of(valid)).not.toThrow();
    const parsed = factory.parse(invalid);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).not.toBeInstanceOf(Error);
    }
    expect(() => factory.of(invalid)).toThrow(IllegalArgumentException);
  });
}

describe("domain construction contracts", () => {
  contract(DesignAttributeName, "value", "");
  contract(UnmappedTargetRef, "value", "");
  contract(DesignEntityName, "value", "");
  contract(DesignTransitionId, "TR-1", "");
  contract(LoweredOriginRef, "value", "");
  contract(DesignObligationId, "DOB-1", "");
  contract(DesignScenarioId, "DSC-1", "");
  contract(DesignMachineId, "SM-1", "");
  contract(DesignBackgroundId, "DBG-1", "");
  contract(TransitionRef, "value", "");
  contract(LoweredId, "value", "");
  contract(ObligationId, "OB-1", "");
  contract(IrAttributeName, "value", "");
  contract(ScenarioId, "SC-1", "");
  contract(BackgroundAssumptionId, "BG-1", "");
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
  contract(RequirementId, "FR-1", "FR-");
  contract(BrRef, "BR1.1", "BR-1");
  contract(QueryLabel, "global", "");
  contract(DesignUnitId, "u1", "");

  test("a derived fence count cannot be negative, fractional, or unsafe", () => {
    expect(FenceCount.of(0).asNumber()).toBe(0);
    for (const count of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => FenceCount.of(count)).toThrow(IllegalArgumentException);
  });

  test("parse does not swallow implementation defects", () => {
    for (const failure of [new Error("bug"), new TypeError("bug")]) {
      expect(() => parseConstruction(() => { throw failure; })).toThrow(failure);
    }
  });

  test("ErrorMessages accepts no errors and keeps its snapshot immutable", () => {
    const empty = ErrorMessages.of([]);
    expect(empty.isEmpty()).toBe(true);
    const source = ["first"];
    const messages = ErrorMessages.of((source).map((value) => ErrorMessage.of(value)));
    source.push("outside");
    expect(messages.toArray().map((value) => value.asString())).toEqual(["first"]);
    expect(messages.add(ErrorMessage.of("second")).toArray().map((value) => value.asString())).toEqual(["first", "second"]);
    expect(messages.toArray().map((value) => value.asString())).toEqual(["first"]);
  });

  test("parse returns an independent ParseError value instead of an exception payload", () => {
    const exception = new IllegalArgumentException({ kind: "example", raw: "invalid" });
    const result = parseConstruction(() => { throw exception; });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ kind: "example", raw: "invalid" });
      expect(result.error).not.toBe(exception);
      expect(result.error).not.toBeInstanceOf(Error);
    }
    const absent = parseConstruction(() => { throw new IllegalArgumentException({ kind: "empty" }); });
    expect(absent).toEqual({ ok: false, error: { kind: "empty" } });
  });
});
