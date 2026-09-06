import { expect, test } from "bun:test";
import {
  DesignEvent,
  DesignWitness,
  LoweredIdentifier,
  LoweredOriginReference,
  RuleSubsumption,
  RuleSubsumptionProbe,
  RuleSubsumptions,
  RuleSubsumptionVerdict,
  SiblingVerdictFinding,
} from "@deep-spec-analysis/design-domain";
import {
  FindingKind,
  FunctionalRequirementReferences,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

const event = (id: string, trigger = "save", value = true) =>
  DesignEvent.of({
    reference: LoweredOriginReference.of(id),
    trigger: TriggerName.of(trigger),
    guard: { op: "bool", value: true },
    effect: { op: "bool", value },
  });

test("a rule cannot be its own subsumption candidate", () => {
  const rule = event("DOB-1");
  expect(() => RuleSubsumptionProbe.of({ subsumer: rule, subsumed: rule })).toThrow(IllegalArgumentException);
  expect(RuleSubsumptionProbe.parse({ subsumer: rule, subsumed: rule })).toEqual({
    ok: false,
    error: { kind: "self-subsumption" },
  });
});

test("subsumption compares distinct rules with the same trigger and canonical effect", () => {
  const first = event("DOB-1");
  expect(RuleSubsumptionProbe.parse({ subsumer: first, subsumed: event("DOB-2") }).ok).toBe(true);
  expect(RuleSubsumptionProbe.parse({ subsumer: first, subsumed: event("DOB-2", "load") })).toEqual({
    ok: false,
    error: { kind: "different-subsumption-triggers" },
  });
  expect(RuleSubsumptionProbe.parse({ subsumer: first, subsumed: event("DOB-2", "save", false) })).toEqual({
    ok: false,
    error: { kind: "different-subsumption-effects" },
  });
});

const verdict = (probe: RuleSubsumptionProbe, conflict = true) =>
  RuleSubsumptionVerdict.fromFinding(
    probe,
    SiblingVerdictFinding.of({
      kind: conflict ? FindingKind.conflict() : FindingKind.completenessGap(),
      targets: [LoweredIdentifier.of("OB-1")],
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      witness: DesignWitness.core([]),
      detail: "solver evidence",
    }),
    DesignWitness.core([]),
    UnitName.of("u1"),
  );

test("an undecided or unproved question cannot become a subsumption relation", () => {
  const probe = RuleSubsumptionProbe.of({ subsumer: event("DOB-1"), subsumed: event("DOB-2") });
  const pending = RuleSubsumptionVerdict.undecided(probe);
  expect(pending.isDecided()).toBe(false);
  expect(pending.isProved()).toBe(false);
  const rejected = verdict(probe, false);
  expect(rejected.isDecided()).toBe(true);
  expect(rejected.isProved()).toBe(false);
  for (const result of [pending, rejected]) {
    expect(() => RuleSubsumption.of(result)).toThrow(IllegalArgumentException);
    expect(RuleSubsumption.parse(result)).toEqual({ ok: false, error: { kind: "unproved-subsumption" } });
  }
});

test("proved directions yield one-way subsumption or mutual equivalence, excluding dead rules", () => {
  const first = event("DOB-1");
  const second = event("DOB-2");
  const forward = verdict(RuleSubsumptionProbe.of({ subsumer: first, subsumed: second }));
  expect(forward.isProved()).toBe(true);
  const relation = RuleSubsumption.of(forward);
  const reverse = RuleSubsumption.of(verdict(RuleSubsumptionProbe.of({ subsumer: second, subsumed: first })));
  expect(RuleSubsumption.parse(forward).ok).toBe(true);
  const live = TargetIdentifiers.of([]);
  expect(RuleSubsumptions.of([relation]).findingsExcept(live).toArray()[0]?.detail()).toStartWith(
    "DOB-2 is subsumed by DOB-1",
  );
  const both = RuleSubsumptions.parse([relation, reverse]);
  if (!both.ok) throw new Error("valid relation fixture");
  expect(
    both.value
      .findingsExcept(live)
      .toArray()
      .map((finding) => finding.detail()),
  ).toEqual([
    "DOB-1 and DOB-2 are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.",
  ]);
  expect(both.value.findingsExcept(TargetIdentifiers.of([TargetIdentifier.of("DOB-1")])).count()).toBe(0);
  const oversized = Array.from({ length: 65_537 }, () => relation);
  expect(() => RuleSubsumptions.of(oversized)).toThrow(IllegalArgumentException);
  expect(RuleSubsumptions.parse(oversized)).toEqual({
    ok: false,
    error: { kind: "too-many-subsumptions", raw: 65_537 },
  });
});
