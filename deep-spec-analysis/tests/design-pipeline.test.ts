// レイヤード design パイプラインの in-process 検証（PR5、#18）。
//
// 1) golden 同値：design fixture を tmp へ複製し、entry と同じ編成
//    （lowering → 実 v1 兄弟 spawn → remap → 組成 → 適合保存 → クロスチェック）
//    を domain/adapter 直で駆動して、書かれた smt.json / quint.json /
//    cross-check.json を期待 golden とバイト比較する。CLI spawn の
//    design-verify スイートと合わせ、同一バイトへの独立経路が 2 本になる。
// 2) ドメイン検査の分岐固定：lowering・remap・順序・クロスチェック・降格の
//    各純関数を直接駆動する（domain 90% 床）。

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalStringify } from "../tools/kernel/adapter/index.ts";
import type { Json } from "../tools/kernel/adapter/index.ts";
import { ContentHash, IrVersion, ArtifactPath } from "../tools/kernel/domain/index.ts";
// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import {
  CheckedUnits,
  DesignFindings,
  DesignInputAnchors,
  DesignReports,
  DesignSkips,
  DesignUnits,
  AttrPaths,
  DesignBackgroundAssumptions,
  DesignMachines,
  DesignObligations,
  DesignScenarios,
  type DesignBackgroundAssumption,
  type DesignMachine,
  type DesignObligation,
  type DesignScenario,
  type DesignValue,
  type DesignFinding,
  type DesignModelComposition,
  type DesignSkipped,
  type SiblingVerdictDocument,
  SiblingVerdictFindings,
  SiblingVerdictSkips,
  DesignModel,
  DesignReport,
  DesignReportId,
  DesignUnit,
  designBackendUnavailableReport,
  designCrossCheckReport,
  designIrUnreadableReport,
  designVersionMismatchReport,
  expressionCanonicalKey,
  lowerUnit,
  remapUnitDocument,
  sortDesignFindings,
  sortDesignSkipped,
  DesignModelId,
} from "../tools/design/domain/index.ts";
import {
  DesignModelRepositoryImpl,
  DesignReportRepositoryImpl,
  SiblingBackendClientImpl,
  probeReached,
  reachabilityVariant,
} from "../tools/design/adapter/index.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures", "design");
const schemaPath = join(toolsDir, "data", "deep-spec-findings-schema.json");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");

function golden(file: string): string {
  return readFileSync(join(fixtures, "expected", file), "utf-8");
}

describe("in-process golden equivalence (domain/adapter chain over real v1 siblings)", () => {
  test("both backends and the converged cross-check reproduce the golden bytes", () => {
    const record = mkdtempSync(join(tmpdir(), "design-usecase-"));
    try {
      cpSync(join(fixtures, "record"), record, { recursive: true });
      const modelPath = join(record, "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md");
      const verifyDir = join(dirname(modelPath), "deep-spec-design-verify");
      const acquired = new DesignModelRepositoryImpl().findById(DesignModelId.of(ap(modelPath)));
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const { model, irHash } = acquired.value;
      const reports = new DesignReportRepositoryImpl(schemaPath);
      // 兄弟 v1 spawn の決定論条件（E2E スイートと同じ seeded simulation）を
      // 明示注入する（bun の spawnSync は実行時の process.env 変異を継がない）。
      const sibling = new SiblingBackendClientImpl({
        toolsDirectory: toolsDir,
        workingDirectory: pluginRoot,
        spawnEnvironment: { ...process.env, AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation", AIDLC_DEEP_SPEC_QUINT_BIN: quintBin },
      });

      for (const backend of ["smt", "quint"] as const) {
        const findings: DesignFinding[] = [];
        const skipped: DesignSkipped[] = [];
        const checkedUnits: string[] = [];
        let method: string | null = null;
        for (const u of model.units()) {
          const lowered = lowerUnit(u, { synthetics: backend === "smt" });
          const run = sibling.runLowered(backend, u, lowered, 55_000);
          expect(run.exit).toBe(0);
          const remapped = remapUnitDocument(u, lowered, run.doc ?? { kind: "unreadable" });
          expect(remapped.unavailable).toBe(null);
          method = method ?? remapped.method;
          findings.push(...remapped.findings);
          skipped.push(...remapped.skipped);
          checkedUnits.push(`unit:${u.name()}`);
          if (backend === "quint") {
            // entry と同じ到達性検出フェーズ：simulation では capability skip。
            for (const sm of [...u.machines()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
              const attrPath = lowered.index.attrPathOfMachine(sm.id) ?? `${sm.entity}.${sm.attribute}`;
              const candidates = u
                .enumValuesOf(attrPath)
                .filter((s) => !sm.initial.includes(s))
                .sort();
              if (candidates.length === 0) continue;
              expect(method).not.toBe("bounded");
              skipped.push({
                target: sm.id,
                reason: "capability",
                unit: u.name(),
                detail: `unreachable-state detection for ${sm.id} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${candidates.join(", ")})`,
              });
            }
          }
        }
        const conformed = reports.conformedOf(
          DesignReport.compose({
            id: DesignReportId.of(ap(verifyDir), backend),
            irVersion: model.irVersion(),
            irHash,
            method: backend === "smt" ? "exhaustive" : (method ?? "simulation"),
            findings: DesignFindings.of(findings),
            skipped: DesignSkips.of(skipped),
            checked: CheckedUnits.of(checkedUnits),
          }),
        );
        expect(reports.save(conformed).ok).toBe(true);
        const siblings = reports.findAllByDirectory(ap(verifyDir));
        expect(siblings.ok).toBe(true);
        if (siblings.ok) {
          expect(
            reports.save(designCrossCheckReport(DesignReportId.of(ap(verifyDir), "cross-check"), model, irHash, siblings.value)).ok,
          ).toBe(true);
        }
        expect(readFileSync(join(verifyDir, `${backend}.json`), "utf-8")).toBe(golden(`${backend}.json`));
      }
      expect(readFileSync(join(verifyDir, "cross-check.json"), "utf-8")).toBe(golden("cross-check.json"));
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  }, 120_000);
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

function unit(seed: {
  unit?: string;
  rawEntities?: DesignValue;
  attrPaths?: Set<string>;
  obligations?: DesignObligation[];
  machines?: DesignMachine[];
  scenarios?: DesignScenario[];
  background?: DesignBackgroundAssumption[];
}): DesignUnit {
  return DesignUnit.reconstitute({
    unit: seed.unit ?? "u1",
    rawEntities: seed.rawEntities ?? [],
    attrPaths: AttrPaths.of([...(seed.attrPaths ?? new Set<string>())]),
    obligations: DesignObligations.of(seed.obligations ?? []),
    machines: DesignMachines.of(seed.machines ?? []),
    scenarios: DesignScenarios.of(seed.scenarios ?? []),
    background: DesignBackgroundAssumptions.of(seed.background ?? []),
  });
}

function model(units: DesignUnit[], irVersion = "1.0.0"): DesignModel {
  return DesignModel.compose({
    id: DesignModelId.of(ap("/test/deep-spec-analysis-functional-formal-model.md")),
    irVersion: IrVersion.reconstitute(irVersion),
    units: DesignUnits.of(units),
  } satisfies DesignModelComposition);
}

describe("lowering (typed compile-down)", () => {
  const machineUnit = unit({
    rawEntities: [{ name: "Ticket", attributes: [{ name: "status", type: { kind: "enum", values: ["open", "closed"] } }] }],
    attrPaths: new Set(["Ticket.status"]),
    obligations: [
      { id: "DOB-2", nature: "invariant", origin: "", brRefs: [], frRefs: ["FR-1"], assert: { op: "bool", value: true } },
      {
        id: "DOB-1",
        nature: "event",
        origin: "",
        brRefs: [],
        frRefs: [],
        trigger: "close",
        guard: { op: "bool", value: true },
        effect: { op: "eq", args: [{ op: "ref", path: "Ticket.status", prime: true }, { op: "enum", value: "closed" }] },
      },
    ],
    machines: [
      {
        id: "SM-1",
        entity: "Ticket",
        attribute: "status",
        initial: ["open"],
        deterministic: true,
        ignores: [{ state: "closed", trigger: "close", reason: "already closed" }],
        transitions: [
          { id: "TR-1", from: "open", to: "closed", trigger: "close", brRefs: [] },
          { id: "TR-2", from: "open", to: "closed", trigger: "close", brRefs: [], guard: { op: "bool", value: true } },
        ],
      },
    ],
    scenarios: [
      { id: "DSC-1", kind: "accept", brRefs: [], frRefs: ["FR-2"], bindings: { "Ticket.status": "open" } },
    ],
    background: [{ id: "BG-A", assert: { op: "bool", value: true } }],
  });

  test("numbering, maps, and the implicit machine encoding are stable", () => {
    const low = lowerUnit(machineUnit, { synthetics: false });
    // 義務は idCompare 順（DOB-1 が DOB-2 の前）→ OB-1=DOB-1(event)、
    // OB-2=DOB-2(invariant)、以後 TR-1/TR-2/ignore。
    expect(low.obligations.toArray().map((o) => `${o.id}:${o.nature}`)).toEqual([
      "OB-1:event",
      "OB-2:invariant",
      "OB-3:event",
      "OB-4:event",
      "OB-5:event",
    ]);
    expect(low.index.originOf("OB-3")).toEqual({ design: "TR-1", kind: "transition" });
    expect(low.index.originOf("OB-5")).toEqual({ design: "SM-1", kind: "ignore" });
    expect(low.index.resolveDesignTarget("SC-1").design).toBe("DSC-1");
    expect(low.background.toArray()[0]?.id).toBe("BG-1");
    expect(low.index.attrPathOfMachine("SM-1")).toBe("Ticket.status");
    expect(low.index.machineOfTransition("TR-1")?.id).toBe("SM-1");
    // 遷移の暗黙ガード：state==from（追加ガードがあれば and 結合）。
    expect(low.obligations.toArray()[2]?.guard).toEqual({
      op: "eq",
      args: [{ op: "ref", path: "Ticket.status" }, { op: "enum", value: "open" }],
    });
    expect(low.obligations.toArray()[3]?.guard?.op).toBe("and");
  });

  test("synthetics add one vac-dead per candidate and shadow pairs for canonically equal effects", () => {
    const low = lowerUnit(machineUnit, { synthetics: true });
    const kinds = low.index.toOriginEntries().map(([, e]) => e.kind);
    expect(kinds.filter((k) => k === "vac-dead").length).toBe(3); // DOB-1, TR-1, TR-2
    const shadows = low.index.toOriginEntries().map(([, e]) => e).filter((e) => e.kind === "vac-shadow");
    // 3 候補（DOB-1・TR-1・TR-2）はすべて同トリガ・正準同一効果
    // （eq(prime(status), "closed")）→ 全順序対 6 件。
    expect(shadows.map((s) => s.pair)).toEqual([
      ["DOB-1", "TR-1"],
      ["DOB-1", "TR-2"],
      ["TR-1", "DOB-1"],
      ["TR-1", "TR-2"],
      ["TR-2", "DOB-1"],
      ["TR-2", "TR-1"],
    ]);
  });

  test("multi-entry sorts cover machines, ignores, scenarios, and background in canonical order", () => {
    const multi = unit({
      machines: [
        {
          id: "SM-2",
          entity: "T",
          attribute: "b",
          initial: [],
          deterministic: true,
          ignores: [
            { state: "y", trigger: "go", reason: "" },
            { state: "x", trigger: "go", reason: "" },
          ],
          transitions: [],
        },
        { id: "SM-1", entity: "T", attribute: "a", initial: [], deterministic: true, ignores: [], transitions: [] },
      ],
      scenarios: [
        { id: "DSC-2", kind: "reject", brRefs: [], frRefs: [], bindings: {} },
        { id: "DSC-1", kind: "accept", brRefs: [], frRefs: [], bindings: {} },
      ],
      background: [
        { id: "BG-B", assert: { op: "bool", value: true } },
        { id: "BG-A", assert: { op: "bool", value: false } },
      ],
    });
    const low = lowerUnit(multi, { synthetics: false });
    // ignores は state/trigger 文字列順（x が y の前）、機械は id 順。
    expect(["SM-1", "SM-2"].map((id) => low.index.attrPathOfMachine(id))).toEqual(["T.a", "T.b"]);
    expect(low.index.resolveDesignTarget("SC-1").design).toBe("DSC-1");
    expect(low.index.resolveDesignTarget("SC-2").design).toBe("DSC-2");
    expect(low.background.toArray().map((b) => b.assert)).toEqual([
      { op: "bool", value: false },
      { op: "bool", value: true },
    ]);
    const ignoreGuards = low.obligations.toArray().filter((o) => low.index.originOf(o.id)?.kind === "ignore").map((o) => o.guard);
    expect(ignoreGuards[0]).toEqual({ op: "eq", args: [{ op: "ref", path: "T.b" }, { op: "enum", value: "x" }] });
    // 2 ユニットの compose はユニット名昇順を不変条件として適用する。
    const m = model([unit({ unit: "u2" }), unit({ unit: "u1" })]);
    expect(m.units().toArray().map((x) => x.name())).toEqual(["u1", "u2"]);
    expect(m.irVersion().asString()).toBe("1.0.0");
    expect(m.id().equals(DesignModelId.of(ap("/test/deep-spec-analysis-functional-formal-model.md")))).toBe(true);
    expect(m.units().toArray()[0]?.id().asString()).toBe(m.units().toArray()[0]?.name() ?? "");
  });

  test("the canonical expression key matches the kernel canonical JSON byte for byte", () => {
    const samples = [
      { op: "eq", args: [{ op: "ref", path: "A.b", prime: true }, { op: "enum", value: "x" }] },
      { op: "and", args: [{ op: "bool", value: true }, { op: "int", value: -3 }] },
      { op: "not", args: [{ op: "ref", path: "A.b" }] },
    ];
    for (const s of samples) {
      expect(expressionCanonicalKey(s)).toBe(canonicalStringify(s as unknown as Json));
    }
  });
});

describe("remap (design vocabulary attribution)", () => {
  const u = unit({
    machines: [
      {
        id: "SM-1",
        entity: "T",
        attribute: "s",
        initial: ["a"],
        deterministic: false,
        ignores: [],
        transitions: [
          { id: "TR-1", from: "a", to: "b", trigger: "go", brRefs: [] },
          { id: "TR-2", from: "a", to: "b", trigger: "go", brRefs: [] },
        ],
      },
    ],
    scenarios: [{ id: "DSC-1", kind: "accept", brRefs: [], frRefs: [], bindings: {} }],
  });
  const low = lowerUnit(u, { synthetics: true });
  const doc = (input: {
    findings?: { kind: string; frRefs: string[]; targets: string[]; witness: Json; detail: string }[];
    skipped?: { target: string; reason: string; detail?: string }[];
  }): SiblingVerdictDocument =>
    ({
      kind: "readable",
      method: "exhaustive",
      findings: SiblingVerdictFindings.of((input.findings ?? []) as never),
      skipped: SiblingVerdictSkips.of(input.skipped ?? []),
    });

  test("unavailable and unreadable sibling documents pass straight through", () => {
    expect(remapUnitDocument(u, low, { kind: "unreadable" }).unavailable).toBe("sibling backend produced no findings document");
    const out = remapUnitDocument(u, low, { kind: "unavailable", reason: "boom", method: "simulation" });
    expect(out.findings.toArray()).toEqual([]);
    expect(out.skipped.toArray()).toEqual([]);
    expect(out.unavailable).toBe("boom");
    expect(out.method).toBe("simulation");
  });

  test("a vac-dead conflict becomes unreachable with the transition/rule wording", () => {
    const deadId = low.index.toOriginEntries().find(([, e]) => e.kind === "vac-dead" && e.design === "TR-1")?.[0] as string;
    const out = remapUnitDocument(u, low, doc({
      findings: [{ kind: "conflict", frRefs: ["FR-1"], targets: [deadId], witness: { core: [`ant_${deadId.replace("-", "_")}`] }, detail: "x" }],
    }));
    expect(out.findings.toArray()[0]?.kind).toBe("unreachable");
    expect(out.findings.toArray()[0]?.detail).toBe(
      "The guard of TR-1 can never hold under the entity constraints and invariants (witness core attached): the transition is dead.",
    );
  });

  test("mutual shadow pairs collapse into one equivalence finding; one-way stays subsumption", () => {
    const ids = low.index.toOriginEntries().filter(([, e]) => e.kind === "vac-shadow");
    const oneWay = remapUnitDocument(u, low, doc({
      findings: [{ kind: "conflict", frRefs: [], targets: [ids[0]?.[0] as string], witness: { core: [] }, detail: "x" }],
    }));
    expect(oneWay.findings.toArray()[0]?.kind).toBe("redundancy");
    expect(oneWay.findings.toArray()[0]?.detail).toContain("is subsumed by");
    const mutual = remapUnitDocument(u, low, doc({
      findings: ids.map(([id]) => ({ kind: "conflict", frRefs: [], targets: [id], witness: { core: [] }, detail: "x" })),
    }));
    expect(mutual.findings.count()).toBe(1);
    expect(mutual.findings.toArray()[0]?.detail).toContain("are mutually redundant");
  });

  test("a same-machine conflict under deterministic:false is waived once per target", () => {
    const trIds = low.index.toOriginEntries().filter(([, e]) => e.kind === "transition").map(([id]) => id);
    const out = remapUnitDocument(u, low, doc({
      findings: [
        { kind: "conflict", frRefs: [], targets: trIds, witness: { core: [] }, detail: "overlap" },
        { kind: "conflict", frRefs: [], targets: trIds, witness: { core: [] }, detail: "overlap again" },
      ],
    }));
    expect(out.findings.toArray()).toEqual([]);
    expect(out.skipped.toArray().map((s) => `${s.target}:${s.reason}`)).toEqual(["TR-1:waived", "TR-2:waived"]);
    expect(out.skipped.toArray()[0]?.detail).toBe(
      "machine SM-1 declares deterministic: false — the same-(state,trigger) overlap check is waived by the model",
    );
  });

  test("details and witness cores are rewritten into design ids, and skips are deduped per (target, reason)", () => {
    const trLow = low.index.toOriginEntries().find(([, e]) => e.kind === "transition" && e.design === "TR-1")?.[0] as string;
    const out = remapUnitDocument(u, low, doc({
      findings: [{
        kind: "completeness-gap",
        frRefs: ["FR-9"],
        targets: [trLow, "SC-1"],
        witness: { core: [`g_${trLow.replace("-", "_")}`, "ty_x"] },
        detail: `No rule for ${trLow} applies`,
      }],
      skipped: [
        { target: trLow, reason: "timeout", detail: `check for ${trLow} timed out` },
        { target: trLow, reason: "timeout", detail: "duplicate" },
        { target: "SC-1", reason: "capability" },
      ],
    }));
    expect(out.findings.toArray()[0]?.targets).toEqual(["DSC-1", "TR-1"]);
    expect(out.findings.toArray()[0]?.detail).toBe("No rule for TR-1 applies");
    expect(out.findings.toArray()[0]?.witness).toEqual({ core: ["g_TR_1", "ty_x"] });
    expect(out.skipped.toArray().map((s) => `${s.target}:${s.reason}`)).toEqual(["TR-1:timeout", "DSC-1:capability"]);
    expect(out.skipped.toArray()[0]?.detail).toBe("check for TR-1 timed out");
  });
});

describe("report ordering, cross-check, and degradations", () => {
  const f = (kind: string, unitName: string, targets: string[], detail: string): DesignFinding => ({
    kind,
    frRefs: [],
    targets,
    witness: { core: [] },
    unit: unitName,
    detail,
  });

  test("the 11-kind order sorts kind, then unit, then targets, then detail; unknown sinks to 99", () => {
    const sorted = sortDesignFindings([
      f("mystery", "u1", ["X"], "z"),
      f("cross-check-disagreement", "u1", ["DSC-1"], "d"),
      f("redundancy", "u2", ["TR-1"], "r"),
      f("redundancy", "u1", ["TR-1"], "r"),
      f("unreachable", "u1", ["TR-1"], "u"),
      f("conflict", "u1", ["DOB-1"], "c"),
      f("refinement-violation", "u1", ["FR-1"], "rv"),
      f("mapping-gap", "u1", ["FR-1"], "mg"),
      f("conflict", "u1", ["DOB-1"], "a"),
    ]);
    expect(sorted.map((x) => x.kind)).toEqual([
      "conflict",
      "conflict",
      "unreachable",
      "redundancy",
      "redundancy",
      "refinement-violation",
      "mapping-gap",
      "cross-check-disagreement",
      "mystery",
    ]);
    // 同 kind・同 unit・同 targets の 2 conflict は detail 昇順（a が c の前）。
    expect(sorted[0]?.detail).toBe("a");
    expect(sorted[1]?.detail).toBe("c");
    expect(sorted[3]?.unit).toBe("u1");
    const skips = sortDesignSkipped([
      { target: "TR-2", reason: "timeout", unit: "u2" },
      { target: "TR-10", reason: "waived", unit: "u1" },
      { target: "TR-2", reason: "capability", unit: "u1" },
    ]);
    expect(skips.map((s) => `${s.unit}:${s.target}:${s.reason}`)).toEqual([
      "u1:TR-2:capability",
      "u1:TR-10:waived",
      "u2:TR-2:timeout",
    ]);
  });

  test("compose sorts inputs by artifact and dedupes checked; degraded strips everything", () => {
    const report = DesignReport.compose({
      id: DesignReportId.of(ap("/v"), "smt"),
      irVersion: IrVersion.reconstitute("1.0.0"),
      irHash: ContentHash.reconstitute("a".repeat(64)),
      method: "exhaustive",
      findings: DesignFindings.of([f("conflict", "u1", ["DOB-1"], "c")]),
      skipped: DesignSkips.of([]),
      inputs: DesignInputAnchors.of([
        { artifact: "b.md", sha256: ContentHash.reconstitute("2".repeat(64)) },
        { artifact: "a.md", sha256: ContentHash.reconstitute("1".repeat(64)) },
      ]),
      checked: CheckedUnits.of(["unit:u2", "unit:u1", "unit:u1"]),
    });
    expect(report.inputs()?.toArray().map((i) => i.artifact)).toEqual(["a.md", "b.md"]);
    expect(report.checked()?.toArray()).toEqual(["unit:u1", "unit:u2"]);
    expect(report.passes()).toBe(false);
    expect(report.findingsCount()).toBe(1);
    expect(report.skippedCount()).toBe(0);
    expect(report.irVersion().asString()).toBe("1.0.0");
    expect(report.irHash().asString()).toBe("a".repeat(64));
    expect(report.method()).toBe("exhaustive");
    expect(report.unavailableReason()).toBe(null);
    expect(report.crossChecked()).toBe(null);
    const back = DesignReport.reconstitute({
      id: report.id(),
      irVersion: report.irVersion(),
      irHash: report.irHash(),
      method: report.method(),
      findings: report.findings(),
      skipped: report.skipped(),
      inputs: report.inputs(),
      checked: report.checked(),
      crossChecked: null,
      unavailableReason: null,
    });
    expect(back.findings().toArray()).toEqual(report.findings().toArray());
    const degraded = report.degraded("why");
    expect(degraded.inputs()).toBe(null);
    expect(degraded.checked()).toBe(null);
    expect(degraded.passes()).toBe(false);
    expect(degraded.isUnavailable()).toBe(true);
    expect(DesignReportId.of(ap("/v"), "smt").equals(DesignReportId.of(ap("/v"), "smt"))).toBe(true);
    expect(DesignReportId.of(ap("/v"), "smt").fileName()).toBe("smt.json");
  });

  test("cross-check compares per (unit, scenario), honors skips, and freezes the design wording", () => {
    const u1 = unit({ scenarios: [{ id: "DSC-1", kind: "accept", brRefs: [], frRefs: ["FR-2", "FR-1"], bindings: {} }] });
    const m = model([u1]);
    const HASH = ContentHash.reconstitute("a".repeat(64));
    const sibling = (backend: string, violated: boolean, skipKey?: string): DesignReport =>
      DesignReport.reconstitute({
        id: DesignReportId.of(ap("/v"), backend),
        irVersion: IrVersion.reconstitute("1.0.0"),
        irHash: HASH,
        method: "exhaustive",
        findings: DesignFindings.of(violated ? [f("scenario-violation", "u1", ["DSC-1"], "x")] : []),
        skipped: DesignSkips.of(skipKey ? [{ target: "DSC-1", reason: "capability", unit: "u1" }] : []),
        inputs: null,
        checked: null,
        crossChecked: null,
        unavailableReason: null,
      });
    const report = designCrossCheckReport(DesignReportId.of(ap("/v"), "cross-check"), m, HASH, DesignReports.of([
      sibling("quint", true),
      sibling("smt", false),
    ]));
    expect(report.findings().toArray()[0]).toEqual({
      kind: "cross-check-disagreement",
      frRefs: ["FR-1", "FR-2"],
      targets: ["DSC-1"],
      witness: { verdicts: { quint: "violated", smt: "clean" } },
      unit: "u1",
      detail: 'Backends "quint" and "smt" disagree on scenario DSC-1 of unit u1. This signals a defect in the formalization or in a backend compiler, not in the design itself.',
    });
    expect(report.crossChecked()?.toArray()).toEqual([
      { backend: "quint", targets: ["DSC-1"] },
      { backend: "smt", targets: ["DSC-1"] },
    ]);
    const skippedOut = designCrossCheckReport(DesignReportId.of(ap("/v"), "cross-check"), m, HASH, DesignReports.of([
      sibling("quint", true, "skip"),
      sibling("smt", false),
    ]));
    expect(skippedOut.findings().toArray()).toEqual([]);
    expect(skippedOut.crossChecked()?.toArray()).toEqual([]);
  });

  test("degradation factories freeze the design wording and span every unit target", () => {
    const u1 = unit({
      obligations: [{ id: "DOB-1", nature: "invariant", origin: "", brRefs: [], frRefs: [] }],
      machines: [{ id: "SM-1", entity: "T", attribute: "s", initial: [], deterministic: true, ignores: [], transitions: [{ id: "TR-1", from: "a", to: "b", trigger: "go", brRefs: [] }] }],
      scenarios: [{ id: "DSC-1", kind: "accept", brRefs: [], frRefs: [], bindings: {} }],
    });
    const m = model([u1], "2.0.0");
    expect(m.supportsMajor(1)).toBe(false);
    expect(u1.allTargets()).toEqual(["DOB-1", "DSC-1", "TR-1"]);
    expect(u1.enumValuesOf("T.s")).toEqual([]);

    const unread = designIrUnreadableReport(DesignReportId.of(ap("/v"), "smt"), "exhaustive", "design IR carries no units[]");
    expect(unread.unavailableReason()).toBe("design IR unreadable: design IR carries no units[] — see the deep-spec-design-ir-valid sensor for details");
    expect(unread.irVersion().asString()).toBe("0.0.0");
    expect(unread.irHash().equals(ContentHash.ofText(""))).toBe(true);

    const mismatch = designVersionMismatchReport(DesignReportId.of(ap("/v"), "quint"), m, ContentHash.reconstitute("a".repeat(64)), "simulation");
    expect(mismatch.skipped().toArray().map((s) => `${s.unit}:${s.target}:${s.reason}`)).toEqual([
      "u1:DOB-1:ir-version-mismatch",
      "u1:DSC-1:ir-version-mismatch",
      "u1:TR-1:ir-version-mismatch",
    ]);
    expect(mismatch.skipped().toArray()[0]?.detail).toBe("design IR major version 2 is not supported by this backend (supports 1.x.x)");

    const down = designBackendUnavailableReport(DesignReportId.of(ap("/v"), "quint"), m, ContentHash.reconstitute("a".repeat(64)), "simulation", "quint CLI is not available", "quint CLI missing");
    expect(down.unavailableReason()).toBe("quint CLI is not available");
    expect(down.skipped().toArray().every((s) => s.reason === "unavailable" && s.detail === "quint CLI missing")).toBe(true);
  });

  test("the reachability variant keeps only events plus the single probe, and probeReached demands the final state", () => {
    const base: Json = {
      irVersion: "1.0.0",
      schema: { entities: [] },
      obligations: [
        { id: "OB-1", nature: "invariant", frRefs: [], assert: { op: "bool", value: true } },
        { id: "OB-2", nature: "event", frRefs: [], trigger: "go", guard: { op: "bool", value: true }, effect: { op: "bool", value: true } },
      ],
      scenarios: [{ id: "SC-1" }],
      background: [{ id: "BG-1", assert: { op: "bool", value: true } }],
    };
    const variant = reachabilityVariant(base, "T.s", "dead") as { [k: string]: Json };
    const obs = variant.obligations as Json[];
    expect(obs.length).toBe(2);
    expect((obs[1] as { id: string }).id).toBe("OB-9999");
    expect(variant.scenarios).toEqual([]);
    expect((variant.background as Json[]).length).toBe(1);

    const reachedDoc: Json = { findings: [{ kind: "conflict", witness: { trace: [{ "T.s": "alive" }, { "T.s": "dead" }] } }] };
    expect(probeReached(reachedDoc, "T.s", "dead")).toBe(true);
    const notReached: Json = { findings: [{ kind: "conflict", witness: { trace: [{ "T.s": "alive" }] } }] };
    expect(probeReached(notReached, "T.s", "dead")).toBe(false);
    const noTrace: Json = { findings: [{ kind: "conflict", witness: {} }] };
    expect(probeReached(noTrace, "T.s", "dead")).toBe(true);
    expect(probeReached({ findings: [] }, "T.s", "dead")).toBe(false);
  });
});

describe("lowered collections and the lowering index (first-class operations)", () => {
  const u = unit({});
  const base = lowerUnit(u, { synthetics: false });

  test("of/add/iterator/count/toArray hold OB/SC/BG numbering order", () => {
    const obs = base.obligations.add({ id: "OB-99", nature: "invariant", frRefs: [] });
    expect(obs.count()).toBe(base.obligations.count() + 1);
    expect([...obs].at(-1)?.id).toBe("OB-99");
    expect(obs.toArray().at(-1)?.nature).toBe("invariant");

    const scs = base.scenarios.add({ id: "SC-99", kind: "accept", frRefs: [], bindings: {} });
    expect(scs.count()).toBe(base.scenarios.count() + 1);
    expect([...scs].at(-1)?.id).toBe("SC-99");
    expect(scs.toArray().at(-1)?.kind).toBe("accept");

    const bgs = base.background.add({ id: "BG-99", assert: { op: "bool", value: true } });
    expect(bgs.count()).toBe(base.background.count() + 1);
    expect([...bgs].at(-1)?.id).toBe("BG-99");
    expect(bgs.toArray().at(-1)?.id).toBe("BG-99");
  });

  test("withPassthrough extends attribution immutably and rewrites fall back verbatim", () => {
    const extended = base.index.withPassthrough("OB-99", "FR-7");
    expect(extended.originOf("OB-99")).toEqual({ design: "FR-7", kind: "passthrough" });
    expect(base.index.originOf("OB-99")).toBe(null);
    expect(extended.resolveDesignTarget("OB-99").design).toBe("FR-7");
    // 未知の lowered id は逐語で残る（detail・witness core とも）。
    expect(base.index.rewriteLoweredIds("No rule for OB-42 applies")).toBe("No rule for OB-42 applies");
    expect(base.index.rewriteLoweredIdTokens("g_OB_42")).toBe("g_OB_42");
    expect(base.index.isTransition("TR-404")).toBe(false);
    expect(base.index.machineOfTransition("TR-404")).toBe(null);
    expect(base.index.attrPathOfMachine("SM-404")).toBe(null);
  });

  test("sibling verdict collections keep document order under add", () => {
    const finding = { kind: "conflict", frRefs: [], targets: ["OB-1"], witness: { core: [] }, detail: "x" };
    const findings = SiblingVerdictFindings.of([]).add(finding);
    expect([...findings]).toEqual([finding]);
    expect(findings.toArray()).toEqual([finding]);

    const skip = { target: "OB-1", reason: "timeout" };
    const skips = SiblingVerdictSkips.of([]).add(skip);
    expect([...skips]).toEqual([skip]);
    expect(skips.toArray()).toEqual([skip]);
  });
});
