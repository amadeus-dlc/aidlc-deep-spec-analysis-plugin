import { describe, expect, test } from "bun:test";
import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import * as Kernel from "@deep-spec/kernel-domain";
import * as Design from "@deep-spec/design-domain";
import * as Requirements from "@deep-spec/requirements-domain";
import * as Refcheck from "@deep-spec/refcheck-domain";
import * as Doctor from "@deep-spec/doctor-domain";

// 全文字列VOのサイズ契約。字句的に不正な長大入力も、サイズで先に拒否する。
const cases = [
  ["TriggerName", Kernel.TriggerName, 128],
  ["TargetId", Kernel.TargetId, 1024],
  ["VerificationMethod", Kernel.VerificationMethod, 10],
  ["PluginVersion", Doctor.PluginVersion, 128],
  ["QueryLabel", Kernel.QueryLabel, 2048],
  ["LoweredId", Design.LoweredId, 128],
  ["AttributePath", Kernel.AttributePath, 257],
  ["RequirementId", Kernel.RequirementId, 128],
  ["BackendName", Kernel.BackendName, 128],
  ["ElementPath", Refcheck.ElementPath, 4096],
  ["TransitionRef", Design.TransitionRef, 128],
  ["StateName", Refcheck.StateName, 128],
  ["AttributeName", Refcheck.AttributeName, 128],
  ["AllowedValue", Refcheck.AllowedValue, 4096],
  ["IrVersion", Kernel.IrVersion, 128],
  ["ReferenceTarget", Refcheck.ReferenceTarget, 4096],
  ["MachineSpec", Refcheck.MachineSpec, 4096],
  ["SourceId", Refcheck.SourceId, 128],
  ["RuleCategory", Refcheck.RuleCategory, 128],
  ["BusinessRuleId", Refcheck.BusinessRuleId, 128],
  ["DesignBackgroundId", Design.DesignBackgroundId, 128],
  ["EntityName", Refcheck.EntityName, 128],
  ["AppliesTo", Refcheck.AppliesTo, 4096],
  ["TypeName", Refcheck.TypeName, 4096],
  ["ComponentName", Refcheck.ComponentName, 128],
  ["DesignObligationId", Design.DesignObligationId, 128],
  ["LoweredOriginRef", Design.LoweredOriginRef, 1024],
  ["DesignAttributeName", Design.DesignAttributeName, 128],
  ["ContractId", Refcheck.ContractId, 128],
  ["DesignMachineId", Design.DesignMachineId, 128],
  ["FindingKind", Kernel.FindingKind, 24],
  ["ArtifactPath", Kernel.ArtifactPath, 4096],
  ["CheckFamily", Refcheck.CheckFamily, 128],
  ["DesignTransitionId", Design.DesignTransitionId, 128],
  ["NormalizedName", Kernel.NormalizedName, 4096],
  ["CardinalityNotation", Refcheck.CardinalityNotation, 128],
  ["BrRef", Design.BrRef, 128],
  ["DesignUnitId", Design.DesignUnitId, 128],
  ["UnitName", Kernel.UnitName, 128],
  ["SkipReason", Kernel.SkipReason, 19],
  ["IrEntityName", Requirements.IrEntityName, 128],
  ["ObligationId", Requirements.ObligationId, 128],
  ["UnmappedTargetRef", Design.UnmappedTargetRef, 1024],
  ["DesignEntityName", Design.DesignEntityName, 128],
  ["DesignScenarioId", Design.DesignScenarioId, 128],
  ["IrAttributeName", Requirements.IrAttributeName, 128],
  ["ScenarioId", Requirements.ScenarioId, 128],
  ["BackgroundAssumptionId", Requirements.BackgroundAssumptionId, 128],
  ["AttributeKind", Kernel.AttributeKind, 128],
  ["ObligationNature", Kernel.ObligationNature, 128],
  ["DeclaredDigest", Kernel.DeclaredDigest, 4096],
  ["DeclaredRuleId", Refcheck.DeclaredRuleId, 128],
  ["ContractParty", Refcheck.ContractParty, 4096],
  ["AttributeDefault", Refcheck.AttributeDefault, 4096],
  ["DesignObligationNature", Design.DesignObligationNature, 128],
  ["DesignObligationOrigin", Design.DesignObligationOrigin, 128],
  ["EnumMember", Kernel.EnumMember, 4096],
  ["ErrorMessage", Kernel.ErrorMessage, 65_536],
  ["InitialState", Design.InitialState, 4096],
] as const;

describe("value size contracts", () => {
  for (const [name, factory, limit] of cases) {
    test(`${name} rejects oversized values before interpreting them`, () => {
      const raw = "!".repeat(limit + 1);
      expect(() => factory.of(raw)).toThrow(IllegalArgumentException);
      if ("parse" in factory) {
        const parsed = factory.parse(raw);
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
          if (name === "VerificationMethod") {
            expect(parsed.error.kind).toBe("unknown-verification-method");
            expect(parsed.error.raw).toBe(raw);
          } else {
            expect(parsed.error.kind).toEndWith("too-long");
            expect(parsed.error.raw).toBe(raw.length);
          }
        }
      }
    });
  }

  test("limits admit valid boundary values and reject the next code unit", () => {
    for (const [factory, raw] of [
      [Kernel.ContentHash, "f".repeat(64)],
      [Kernel.TriggerName, "a".repeat(128)],
      [Kernel.AttributePath, "a".repeat(128) + "." + "b".repeat(128)],
      [Kernel.ArtifactPath, "/" + "a".repeat(4095)],
      [Kernel.EnumMember, "a".repeat(4096)],
      [Kernel.ErrorMessage, "a".repeat(65_536)],
    ] as const) {
      expect(factory.of(raw).asString()).toBe(raw);
      expect(() => factory.of(raw + "a")).toThrow(IllegalArgumentException);
    }
  });

  test("normalization checks the original size before removing characters", () => {
    expect(() => Kernel.NormalizedName.of("-".repeat(4097))).toThrow(IllegalArgumentException);
    expect(Kernel.NormalizedName.of("Order_Item").asString()).toBe("orderitem");
  });

  test("a version at its size limit still round-trips through a Git tag", () => {
    const version = Doctor.PluginVersion.of("1".repeat(124) + ".0.0");
    const parsed = Doctor.PluginVersion.parse(version.asTag());
    expect(parsed.ok && parsed.value.equals(version)).toBe(true);
    expect(Doctor.PluginVersion.parse("v" + "1".repeat(125) + ".0.0").ok).toBe(false);
  });
});
