import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDesignModel, RefinementSolverClientImplementation } from "@deep-spec-analysis/design-adapter";
import {
  AttributeMapping,
  AttributeMappings,
  DesignFindings,
  DesignReport,
  DesignReportIdentifier,
  DesignSkips,
  EventMappings,
  MachineReachability,
  ReachabilityProbe,
  ReachabilityVerdict,
  RefinementAttribute,
  RefinementAttributes,
  RefinementObligation,
  RefinementObligations,
  RefinementPreparation,
  RefinementRequirements,
  RefinementScenarios,
  RefinementUnitMap,
  UnitRefinementPlan,
  UnmappedDeclarations,
} from "@deep-spec-analysis/design-domain";
import {
  ArtifactPath,
  AttributePath,
  ContentHash,
  EnumerationMember,
  FunctionalRequirementReferences,
  IntermediateRepresentationVersion,
  ObligationNature,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import { FormalModelIdentifier, ObligationIdentifier } from "@deep-spec-analysis/requirements-domain";

function designUnit() {
  const parsed = parseDesignModel({
    irKind: "design",
    irVersion: "1.0.0",
    units: [
      {
        unit: "u1",
        schema: {
          entities: [
            { name: "D", attributes: [{ name: "flag", type: { kind: "bool" } }] },
            { name: "E", attributes: [{ name: "phase", type: { kind: "enum", values: ["open", "closed"] } }] },
          ],
        },
        obligations: [
          {
            id: "DOB-1",
            nature: "invariant",
            origin: "o",
            brRefs: [],
            frRefs: [],
            assert: { op: "bool", value: true },
          },
        ],
        stateMachines: [
          { id: "SM-1", entity: "E", attribute: "phase", initial: ["open"], transitions: [], ignores: [] },
        ],
        scenarios: [],
        background: [],
      },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const unit = [...parsed.value.units][0];
  if (unit === undefined) throw new Error("fixture unit is missing");
  return unit;
}

function refinementPlan(unit: ReturnType<typeof designUnit>): UnitRefinementPlan {
  return UnitRefinementPlan.of(
    unit,
    RefinementUnitMap.of({
      unit: unit.id(),
      attrMap: AttributeMappings.of([
        AttributeMapping.of(AttributePath.of("R.flag"), { kind: "expression", expr: { op: "ref", path: "D.flag" } }),
      ]),
      eventMap: EventMappings.of([]),
      unmapped: UnmappedDeclarations.of([]),
    }),
    RefinementRequirements.of({
      id: FormalModelIdentifier.of(ArtifactPath.of("requirements.md")),
      hash: ContentHash.ofText("requirements"),
      attributes: RefinementAttributes.of([RefinementAttribute.of({ path: AttributePath.of("R.flag"), kind: "bool" })]),
      obligations: RefinementObligations.of([
        RefinementObligation.of({
          id: ObligationIdentifier.of("OB-1"),
          nature: ObligationNature.of("invariant"),
          functionalRequirementReferences: FunctionalRequirementReferences.of([]),
          assert: { op: "ref", path: "R.flag" },
        }),
      ]),
      scenarios: RefinementScenarios.of([]),
    }),
    ArtifactPath.of("map.md"),
  );
}

function report(): DesignReport {
  return DesignReport.compose({
    id: DesignReportIdentifier.of(ArtifactPath.of("verify"), "smt"),
    irVersion: IntermediateRepresentationVersion.of("1.0.0"),
    irHash: ContentHash.ofText("design"),
    method: "exhaustive",
    findings: DesignFindings.of([]),
    skipped: DesignSkips.of([]),
  });
}

test("duplicate design targets fail through parseDesignModel without throwing", () => {
  const raw = {
    irKind: "design",
    irVersion: "1.0.0",
    units: [
      {
        unit: "u1",
        schema: { entities: [] },
        obligations: [
          { id: "DOB-1", nature: "invariant", origin: "o", brRefs: [], frRefs: [] },
          { id: "DOB-1", nature: "invariant", origin: "o", brRefs: [], frRefs: [] },
        ],
        stateMachines: [],
        scenarios: [],
        background: [],
      },
    ],
  };
  let result: ReturnType<typeof parseDesignModel> | undefined;
  expect(() => {
    result = parseDesignModel(raw);
  }).not.toThrow();
  expect(result?.ok).toBe(false);
  if (result !== undefined && !result.ok) expect(result.error).toContain("duplicate-design-target");
});

test("malformed refinement solver results become unavailable instead of throwing", () => {
  const directory = mkdtempSync(join(tmpdir(), "design-refinement-child-"));
  try {
    const child = join(directory, "child.mjs");
    writeFileSync(child, 'process.stdout.write(JSON.stringify({ results: [{ status: "sat" }] }));\n');
    const unit = designUnit();
    const check = new RefinementSolverClientImplementation({
      childHostPath: child,
      perQueryTimeoutMs: 100,
      runtimeOverride: "node",
      workingDirectory: directory,
    }).check(refinementPlan(unit), 1_000);
    const recorded = check.recordedIn(report());
    expect(
      recorded
        .skipped()
        .toArray()
        .some((skip) => skip.reason() === "unavailable"),
    ).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reachability and preparation bounds inspect iterator results, not only array length or map size", () => {
  const unit = designUnit();
  const lowered = unit.lowered({ synthetics: false });
  if (!lowered.ok) throw new Error(lowered.error.kind);
  const machine = unit.machines().head();
  const probe = ReachabilityProbe.of(
    unit,
    lowered.value,
    machine,
    AttributePath.of("E.phase"),
    EnumerationMember.of("closed"),
  );
  const probes = [probe];
  Object.defineProperty(probes, Symbol.iterator, {
    value: function* () {
      for (let index = 0; index < 65_537; index++) yield probe;
    },
  });
  const input = { unit, machine, probes, bounded: true, observations: new Map() };
  expect(() => MachineReachability.of(input)).toThrow(IllegalArgumentException);
  const parsedMachine = MachineReachability.parse(input);
  expect(parsedMachine.ok).toBe(false);
  if (!parsedMachine.ok) {
    expect(parsedMachine.error.kind).toBe("too-many-reachability-probes");
    expect(parsedMachine.error).not.toBeInstanceOf(Error);
  }

  const observations = new Map<ReachabilityProbe, ReachabilityVerdict>([[probe, ReachabilityVerdict.reached()]]);
  Object.defineProperty(observations, Symbol.iterator, {
    value: function* () {
      for (let index = 0; index < 65_537; index++) yield [probe, ReachabilityVerdict.reached()] as const;
    },
  });
  const boundedInput = { unit, machine, probes: [probe], bounded: true, observations };
  expect(() => MachineReachability.of(boundedInput)).toThrow(IllegalArgumentException);
  const parsedObservations = MachineReachability.parse(boundedInput);
  expect(parsedObservations.ok).toBe(false);
  if (!parsedObservations.ok) {
    expect(parsedObservations.error.kind).toBe("too-many-reachability-probes");
    expect(parsedObservations.error).not.toBeInstanceOf(Error);
  }

  const plan = refinementPlan(unit);
  const plans = [plan];
  Object.defineProperty(plans, Symbol.iterator, {
    value: function* () {
      for (let index = 0; index < 65_537; index++) yield plan;
    },
  });
  expect(() => RefinementPreparation.of(plans, DesignSkips.of([]), null)).toThrow(IllegalArgumentException);
  const parsedPreparation = RefinementPreparation.parse(plans, DesignSkips.of([]), null);
  expect(parsedPreparation.ok).toBe(false);
  if (!parsedPreparation.ok) {
    expect(parsedPreparation.error.kind).toBe("too-many-refinement-plans");
    expect(parsedPreparation.error).not.toBeInstanceOf(Error);
  }
});

test("reachability and preparation accept the exact budget and reject a larger observation map", () => {
  const unit = designUnit();
  const lowered = unit.lowered({ synthetics: false });
  if (!lowered.ok) throw new Error(lowered.error.kind);
  const machine = unit.machines().head();
  const path = AttributePath.of("E.phase");
  const state = EnumerationMember.of("closed");
  const probes = Array.from({ length: 65_536 }, () => ReachabilityProbe.of(unit, lowered.value, machine, path, state));
  const observations = new Map(probes.map((probe) => [probe, ReachabilityVerdict.reached()] as const));
  const input = { unit, machine, probes, bounded: true, observations };
  expect(MachineReachability.of(input).probeCount()).toBe(65_536);
  expect(MachineReachability.parse(input).ok).toBe(true);
  observations.set(ReachabilityProbe.of(unit, lowered.value, machine, path, state), ReachabilityVerdict.reached());
  expect(() => MachineReachability.of(input)).toThrow(IllegalArgumentException);
  const parsed = MachineReachability.parse(input);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.error.kind).toBe("too-many-reachability-probes");
    expect(parsed.error).not.toBeInstanceOf(Error);
  }

  const plan = refinementPlan(unit);
  const plans = Array.from({ length: 65_536 }, () => plan);
  expect([...RefinementPreparation.of(plans, DesignSkips.of([]), null)]).toHaveLength(65_536);
  expect(RefinementPreparation.parse(plans, DesignSkips.of([]), null).ok).toBe(true);
});
