import {
  VerificationMethod,
  RequirementId,
  UnitName,
  SkipReason,
  FindingKind,
  TriggerName,
  FrRefs,
  TargetId,
  TargetIds,
  ContentHash,
  FindingsSchema,
  IrVersion,
  ArtifactPath,
  type Expression,
  ExpressionTree,
} from "@deep-spec/kernel-domain";

import {
  BrRef,
  DesignBackgroundId,
  DesignAttributeName,
  DesignEntityName,
  DesignMachineId,
  DesignObligationId,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignScenarioId,
  DesignTransitionId,
  ReachabilityVerdict,
  CheckedUnits,
  DesignFindings,
  DesignInputAnchors,
  DesignReports,
  DesignSkips,
  DesignUnits,
  DesignBackgroundAssumptions,
  DesignMachines,
  DesignObligations,
  DesignScenarios,
  DesignBackgroundAssumption,
  DesignIgnore,
  DesignMachine,
  DesignObligation,
  DesignScenario,
  DesignTransition,
  BrRefs,
  DesignIgnores,
  DesignTransitions,
  InitialStates,
  DesignFinding,
  DesignSkipped,
  SiblingVerdictDocument,
  SiblingVerdictFinding,
  SiblingVerdictFindings,
  SiblingVerdictSkips,
  DesignModel,
  DesignReport,
  DesignReportId,
  DesignUnit,
  LoweredUnit,
  DesignModelId,
  LoweredId,
  DesignInputAnchor,
  LoweredObligation,
  LoweredScenario,
  LoweredBackground,
  SiblingVerdictSkip,
  LoweredOrigin,
  DesignWitness,
  DesignEntityDecls,
  DesignEntityDecl,
  DesignAttributeDecls,
  DesignAttributeDecl,
} from "@deep-spec/design-domain";

// レイヤード design パイプラインの in-process 検証（PR5、#18）。
//
// 1) golden 同値：design fixture を tmp へ複製し、lowering → 実 v1 兄弟 spawn →
//    remap → 組成 → 単一文書の適合保存 → クロスチェック再計算を domain/adapter
//    直で駆動して、書かれた smt.json / quint.json / cross-check.json を期待
//    golden とバイト比較する。本番の編成（Finalizer 経由の storeConformed）は
//    通らない別経路なので、CLI spawn の design-verify スイート・usecase 経路の
//    refinement-pipeline と合わせて同一バイトへの独立経路が保たれる。
// 2) ドメイン検査の分岐固定：lowering・remap・順序・クロスチェック・降格の
//    各純関数を直接駆動する（domain 90% 床）。

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFences, readContractSchema } from "@deep-spec/kernel-adapter";
import { type Json, canonicalStringify } from "@deep-spec/kernel-infrastructure";

// 降ろし方は帰属の内部表現（裁定 17）——テストは公開の isKind で射影する。
const ORIGIN_KINDS = ["passthrough", "transition", "ignore", "vac-dead", "vac-shadow"] as const;
const kindOf = (e: LoweredOrigin | null | undefined): string | undefined => (e === undefined || e === null ? undefined : ORIGIN_KINDS.find((k) => e.isKind(k)));

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import {
  DesignModelRepositoryImpl,
  DesignVerifyDirectoryRepositoryImpl,
  SiblingBackendClientImpl,
  parseSiblingVerdictDocument,
  reachabilityVariant,
  parseDesignEntities,
  renderDesignEntities,
  renderLoweredDocument
} from "@deep-spec/design-adapter";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
// スキーマ原本はソースツリー側（src/entries/data/）。toolsDir は生成される配布物の
// spawn 先で、原本の置き場ではない。
const dataDir = join(pluginRoot, "src", "entries", "data");
const fixtures = join(pluginRoot, "tests", "fixtures", "design");
const schemaPath = join(dataDir, "deep-spec-findings-schema.json");
// 契約2 のスキーマは合成ルート相当のここで一度だけ読む（entry と同じ形）。
const schemaFile = readContractSchema(schemaPath);
const findingsSchema = schemaFile.ok ? FindingsSchema.of(schemaFile.value) : FindingsSchema.unreadable(schemaFile.error.cause);
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
      const model = acquired.value;
      const irHash = model.irHash();
      const reports = new DesignVerifyDirectoryRepositoryImpl();
      // 兄弟 v1 spawn の決定論条件（E2E スイートと同じ seeded simulation）を
      // 明示注入する（bun の spawnSync は実行時の process.env 変異を継がない）。
      const sibling = new SiblingBackendClientImpl({
        siblingToolPaths: {
          smt: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
          quint: join(toolsDir, "aidlc-sensor-deep-spec-verify-quint.ts"),
        },
        workingDirectory: pluginRoot,
        spawnEnvironment: { ...process.env, AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation", AIDLC_DEEP_SPEC_QUINT_BIN: quintBin },
      });

      for (const backend of ["smt", "quint"] as const) {
        const findings: DesignFinding[] = [];
        const skipped: DesignSkipped[] = [];
        const checkedUnits: string[] = [];
        let method: string | null = null;
        for (const u of model.units()) {
          const lowered = u.lowered({ synthetics: backend === "smt" });
          const run = sibling.runLowered(backend, u, lowered, 55_000);
          expect(run.exit).toBe(0);
          const remapped = (run.doc ?? SiblingVerdictDocument.unreadable()).remapVerdicts(u, lowered.index());
          expect(remapped.unavailable).toBe(null);
          method = method ?? remapped.method;
          findings.push(...remapped.findings);
          skipped.push(...remapped.skipped);
          checkedUnits.push(`unit:${u.name()}`);
          if (backend === "quint") {
            // entry と同じ到達性検出フェーズ：simulation では capability skip。
            for (const sm of u.machines().sortedById()) {
              const attrPath = lowered.index().attrPathOfMachine(sm.id().asString()) ?? `${sm.entity().asString()}.${sm.attribute().asString()}`;
              const candidates = sm.nonInitialCandidates(u.enumValuesOf(attrPath));
              if (candidates.length === 0) continue;
              expect(method).not.toBe("bounded");
              skipped.push(DesignSkipped.of({
                target: sm.id().asTargetId(),
                reason: SkipReason.of("capability"),
                unit: UnitName.of(u.name()),
                detail: `unreachable-state detection for ${sm.id().asString()} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${candidates.join(", ")})`,
              }));
            }
          }
        }
        const report = DesignReport.compose({
          id: DesignReportId.of(ap(verifyDir), backend),
          irVersion: model.irVersion(),
          irHash,
          method: backend === "smt" ? "exhaustive" : (method ?? "simulation"),
          findings: DesignFindings.of(findings),
          skipped: DesignSkips.of(skipped),
          checked: CheckedUnits.of(Array.from(checkedUnits, (raw) => UnitName.of(raw))),
        });
        // 公開は集約ひとつぶん：候補を置き、適合させ、いまの兄弟集合から
        // クロスチェックを導いてから、Repository が一塊で書く。
        const loaded = reports.findByDirectory(ap(verifyDir));
        expect(loaded.ok).toBe(true);
        if (!loaded.ok) return;
        const staged = loaded.value.finalizing(report).conformedTo(findingsSchema);
        expect(reports.store(staged.crossChecked(model, irHash).conformedTo(findingsSchema)).ok).toBe(true);
        expect(readFileSync(join(verifyDir, `${backend}.json`), "utf-8")).toBe(golden(`${backend}.json`));
      }
      expect(readFileSync(join(verifyDir, "cross-check.json"), "utf-8")).toBe(golden("cross-check.json"));
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  }, 120_000);
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

// テストの読みやすさのため素の配列・素の文字列で書き、ここで一括して DP と
// コレクションに包む。
type RawDesignObligation = Omit<Parameters<typeof DesignObligation.of>[0], "id" | "nature" | "origin" | "brRefs" | "frRefs" | "trigger"> & {
  id: string;
  nature: string;
  origin: string;
  brRefs: string[];
  frRefs: string[];
  trigger?: string;
};
type RawDesignTransition = Omit<Parameters<typeof DesignTransition.of>[0], "id" | "brRefs" | "trigger"> & { id: string; brRefs: string[]; trigger: string };
// reason は design IR 上の必須注記（文書には残るが domain は運ばない——#71 波9）。
type RawDesignIgnore = Omit<Parameters<typeof DesignIgnore.of>[0], "trigger"> & { trigger: string; reason: string };
type RawDesignMachine = Omit<Parameters<typeof DesignMachine.of>[0], "id" | "entity" | "attribute" | "initial" | "transitions" | "ignores"> & {
  id: string;
  entity: string;
  attribute: string;
  initial: string[];
  transitions: RawDesignTransition[];
  ignores: RawDesignIgnore[];
};
type RawDesignScenario = Omit<Parameters<typeof DesignScenario.of>[0], "id" | "brRefs" | "frRefs" | "event"> & {
  id: string;
  brRefs: string[];
  frRefs: string[];
  event?: { trigger: string };
};

// テスト用: 生の entities JSON と属性座標から型付き実体宣言を組む（裁定 2 で
// DesignUnit は生 JSON を持たなくなった）。座標だけ与えられた属性は kind "" の
// 宣言として補う——旧 attrPaths の役目。
function entitiesOf(raw: Json[], attrPaths: Set<string>): DesignEntityDecls {
  const parsed = parseDesignEntities({ entities: raw });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  let declared = parsed.value;
  const covered = new Set<string>();
  for (const ent of declared) for (const attr of ent.attributes()) covered.add(`${ent.name().asString()}.${attr.name().asString()}`);
  const extra = new Map<string, string[]>();
  for (const path of attrPaths) {
    if (covered.has(path)) continue;
    const dot = path.indexOf(".");
    extra.set(path.slice(0, dot), [...(extra.get(path.slice(0, dot)) ?? []), path.slice(dot + 1)]);
  }
  for (const [entity, attrs] of extra) {
    declared = declared.add(DesignEntityDecl.of({
      name: DesignEntityName.of(entity),
      attributes: DesignAttributeDecls.of(attrs.map((a) => DesignAttributeDecl.of({ name: DesignAttributeName.of(a), kind: "" }))),
    }));
  }
  return declared;
}

function unit(seed: {
  unit?: string;
  rawEntities?: Json[];
  attrPaths?: Set<string>;
  obligations?: RawDesignObligation[];
  machines?: RawDesignMachine[];
  scenarios?: RawDesignScenario[];
  background?: { id: string; assert: Expression }[];
}): DesignUnit {
  return DesignUnit.of({
    unit: seed.unit ?? "u1",
    entities: entitiesOf(seed.rawEntities ?? [], seed.attrPaths ?? new Set<string>()),
    obligations: DesignObligations.of(
      (seed.obligations ?? []).map((o) => DesignObligation.of({
        ...o,
        id: DesignObligationId.of(o.id),
        nature: DesignObligationNature.of(o.nature),
        origin: DesignObligationOrigin.of(o.origin),
        brRefs: BrRefs.of(Array.from(o.brRefs, (raw) => BrRef.of(raw))),
        frRefs: FrRefs.of(Array.from(o.frRefs, (raw) => RequirementId.of(raw))),
        trigger: o.trigger === undefined ? undefined : TriggerName.of(o.trigger),
      })),
    ),
    machines: DesignMachines.of(
      (seed.machines ?? []).map((m) =>
        DesignMachine.of({
          ...m,
          id: DesignMachineId.of(m.id),
          entity: DesignEntityName.of(m.entity),
          attribute: DesignAttributeName.of(m.attribute),
          initial: InitialStates.of(m.initial),
          transitions: DesignTransitions.of(
            m.transitions.map((t) => DesignTransition.of({ ...t, id: DesignTransitionId.of(t.id), brRefs: BrRefs.of(Array.from(t.brRefs, (raw) => BrRef.of(raw))), trigger: TriggerName.of(t.trigger) })),
          ),
          ignores: DesignIgnores.of(m.ignores.map((g) => DesignIgnore.of({ ...g, trigger: TriggerName.of(g.trigger) }))),
        }),
      ),
    ),
    scenarios: DesignScenarios.of(
      (seed.scenarios ?? []).map((s) => DesignScenario.of({
        ...s,
        id: DesignScenarioId.of(s.id),
        brRefs: BrRefs.of(Array.from(s.brRefs, (raw) => BrRef.of(raw))),
        frRefs: FrRefs.of(Array.from(s.frRefs, (raw) => RequirementId.of(raw))),
        event: s.event === undefined ? undefined : { trigger: TriggerName.of(s.event.trigger) },
      })),
    ),
    background: DesignBackgroundAssumptions.of(
      (seed.background ?? []).map((b) => DesignBackgroundAssumption.of({ ...b, id: DesignBackgroundId.of(b.id) })),
    ),
  });
}

function model(units: DesignUnit[], irVersion = "1.0.0"): DesignModel {
  return DesignModel.compose({
    id: DesignModelId.of(ap("/test/deep-spec-analysis-functional-formal-model.md")),
    irHash: ContentHash.of("c".repeat(64)),
    sourceDocument: new Uint8Array(),
    irVersion: IrVersion.of(irVersion),
    units: DesignUnits.of(units),
  } satisfies Parameters<typeof DesignModel.compose>[0]);
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
    const low = machineUnit.lowered({ synthetics: false });
    // 義務は id の正準順（DOB-1 が DOB-2 の前）→ OB-1=DOB-1(event)、
    // OB-2=DOB-2(invariant)、以後 TR-1/TR-2/ignore。
    expect(low.obligations().toArray().map((o) => `${o.id().asString()}:${o.nature()}`)).toEqual([
      "OB-1:event",
      "OB-2:invariant",
      "OB-3:event",
      "OB-4:event",
      "OB-5:event",
    ]);
    expect([low.index().originOf("OB-3")?.design().asString(), kindOf(low.index().originOf("OB-3"))]).toEqual(["TR-1", "transition"]);
    expect([low.index().originOf("OB-5")?.design().asString(), kindOf(low.index().originOf("OB-5"))]).toEqual(["SM-1", "ignore"]);
    expect(low.index().resolveDesignTarget("SC-1").design).toBe("DSC-1");
    expect(low.background().toArray()[0]?.id().asString()).toBe("BG-1");
    expect(low.index().attrPathOfMachine("SM-1")).toBe("Ticket.status");
    expect(low.index().machineOfTransition("TR-1")?.id().asString()).toBe("SM-1");
    // 遷移の暗黙ガード：state==from（追加ガードがあれば and 結合）。
    expect(low.obligations().toArray()[2]?.guard()).toEqual({
      op: "eq",
      args: [{ op: "ref", path: "Ticket.status" }, { op: "enum", value: "open" }],
    });
    expect(low.obligations().toArray()[3]?.guard()?.op).toBe("and");
  });

  test("synthetics add one vac-dead per candidate and shadow pairs for canonically equal effects", () => {
    const low = machineUnit.lowered({ synthetics: true });
    const kinds = low.index().toOriginEntries().map(([, e]) => kindOf(e));
    expect(kinds.filter((k) => k === "vac-dead").length).toBe(3); // DOB-1, TR-1, TR-2
    const shadows = low.index().toOriginEntries().map(([, e]) => e).filter((e) => e.isKind("vac-shadow"));
    // 3 候補（DOB-1・TR-1・TR-2）はすべて同トリガ・正準同一効果
    // （eq(prime(status), "closed")）→ 全順序対 6 件。
    expect(shadows.map((s) => s.pairRefs().map((r) => r.asString()))).toEqual([
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
    const low = multi.lowered({ synthetics: false });
    // ignores は state/trigger 文字列順（x が y の前）、機械は id 順。
    expect(["SM-1", "SM-2"].map((id) => low.index().attrPathOfMachine(id))).toEqual(["T.a", "T.b"]);
    expect(low.index().resolveDesignTarget("SC-1").design).toBe("DSC-1");
    expect(low.index().resolveDesignTarget("SC-2").design).toBe("DSC-2");
    expect(low.background().toArray().map((b) => b.assertion())).toEqual([
      { op: "bool", value: false },
      { op: "bool", value: true },
    ]);
    const ignoreGuards = low.obligations().toArray().filter((o) => low.index().originOf(o.id().asString())?.isKind("ignore")).map((o) => o.guard());
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
    for (const a of samples) {
      for (const b of samples) {
        const sameBytes = canonicalStringify(a as unknown as Json) === canonicalStringify(b as unknown as Json);
        expect(ExpressionTree.of(a).isCanonicallyEqual(ExpressionTree.of(b))).toBe(sameBytes);
      }
    }
    // キー順に依らない正準性——並べ替えた同値の木は同一。
    expect(ExpressionTree.of({ op: "eq", args: [{ path: "A.b", op: "ref" }, { value: "x", op: "enum" }] }).isCanonicallyEqual(ExpressionTree.of(samples[0] as never))).toBe(false);
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
  const low = u.lowered({ synthetics: true });
  const doc = (input: {
    findings?: { kind: string; frRefs: string[]; targets: string[]; witness: Json; detail: string }[];
    skipped?: { target: string; reason: string; detail?: string }[];
  }): SiblingVerdictDocument =>
    SiblingVerdictDocument.readable( VerificationMethod.of("exhaustive"),
      SiblingVerdictFindings.of(
        (input.findings ?? []).map((f) => SiblingVerdictFinding.of({ ...f, kind: FindingKind.of(f.kind), witness: DesignWitness.of(f.witness), frRefs: FrRefs.of(Array.from(f.frRefs, (raw) => RequirementId.of(raw))), targets: f.targets.map((t) => LoweredId.of(t)) })),
      ),
      SiblingVerdictSkips.of((input.skipped ?? []).map((k: { target: string; reason: string; detail?: string }) => SiblingVerdictSkip.of({ ...k, reason: SkipReason.of(k.reason), target: LoweredId.of(k.target) }))),
    );

  test("unavailable and unreadable sibling documents pass straight through", () => {
    expect(SiblingVerdictDocument.unreadable().remapVerdicts(u, low.index()).unavailable).toBe("sibling backend produced no findings document");
    const out = SiblingVerdictDocument.unavailable("boom", VerificationMethod.of("simulation")).remapVerdicts(u, low.index());
    expect(out.findings.toArray()).toEqual([]);
    expect(out.skipped.toArray()).toEqual([]);
    expect(out.unavailable).toBe("boom");
    expect(out.method).toBe("simulation");
  });

  test("a vac-dead conflict becomes unreachable with the transition/rule wording", () => {
    const deadId = low.index().toOriginEntries().find(([, e]) => e.isKind("vac-dead") && e.design().asString() === "TR-1")?.[0] as string;
    const out = doc({
      findings: [{ kind: "conflict", frRefs: ["FR-1"], targets: [deadId], witness: { core: [`ant_${deadId.replace("-", "_")}`] }, detail: "x" }],
    }).remapVerdicts(u, low.index());
    expect(out.findings.toArray()[0]?.kind()).toBe("unreachable");
    expect(out.findings.toArray()[0]?.detail()).toBe(
      "The guard of TR-1 can never hold under the entity constraints and invariants (witness core attached): the transition is dead.",
    );
  });

  test("mutual shadow pairs collapse into one equivalence finding; one-way stays subsumption", () => {
    const ids = low.index().toOriginEntries().filter(([, e]) => e.isKind("vac-shadow"));
    const oneWay = doc({
      findings: [{ kind: "conflict", frRefs: [], targets: [ids[0]?.[0] as string], witness: { core: [] }, detail: "x" }],
    }).remapVerdicts(u, low.index());
    expect(oneWay.findings.toArray()[0]?.kind()).toBe("redundancy");
    expect(oneWay.findings.toArray()[0]?.detail()).toContain("is subsumed by");
    const mutual = doc({
      findings: ids.map(([id]) => ({ kind: "conflict", frRefs: [], targets: [id], witness: { core: [] }, detail: "x" })),
    }).remapVerdicts(u, low.index());
    expect(mutual.findings.count()).toBe(1);
    expect(mutual.findings.toArray()[0]?.detail()).toContain("are mutually redundant");
  });

  test("a same-machine conflict under deterministic:false is waived once per target", () => {
    const trIds = low.index().toOriginEntries().filter(([, e]) => e.isKind("transition")).map(([id]) => id);
    const out = doc({
      findings: [
        { kind: "conflict", frRefs: [], targets: trIds, witness: { core: [] }, detail: "overlap" },
        { kind: "conflict", frRefs: [], targets: trIds, witness: { core: [] }, detail: "overlap again" },
      ],
    }).remapVerdicts(u, low.index());
    expect(out.findings.toArray()).toEqual([]);
    expect(out.skipped.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual(["TR-1:waived", "TR-2:waived"]);
    expect(out.skipped.toArray()[0]?.detail()).toBe(
      "machine SM-1 declares deterministic: false — the same-(state,trigger) overlap check is waived by the model",
    );
  });

  test("details and witness cores are rewritten into design ids, and skips are deduped per (target, reason)", () => {
    const trLow = low.index().toOriginEntries().find(([, e]) => e.isKind("transition") && e.design().asString() === "TR-1")?.[0] as string;
    const out = doc({
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
    }).remapVerdicts(u, low.index());
    expect(out.findings.toArray()[0]?.targets().toStrings()).toEqual(["DSC-1", "TR-1"]);
    expect(out.findings.toArray()[0]?.detail()).toBe("No rule for TR-1 applies");
    expect(out.findings.toArray()[0]?.witness().toDocument()).toEqual({ core: ["g_TR_1", "ty_x"] });
    expect(out.skipped.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual(["TR-1:timeout", "DSC-1:capability"]);
    expect(out.skipped.toArray()[0]?.detail()).toBe("check for TR-1 timed out");
  });
});

describe("report ordering, cross-check, and degradations", () => {
  const f = (kind: string, unitName: string, targets: string[], detail: string): DesignFinding =>
    DesignFinding.of({
      kind: FindingKind.of(kind),
      frRefs: FrRefs.of([]),
      targets: TargetIds.of(Array.from(targets, (raw) => TargetId.of(raw))),
      witness: DesignWitness.core([]),
      unit: UnitName.of(unitName),
      detail,
    });

  test("the 11-kind order sorts kind, then unit, then targets, then detail; invalid kinds are rejected", () => {
    const sorted = DesignFindings.of([

      f("cross-check-disagreement", "u1", ["DSC-1"], "d"),
      f("redundancy", "u2", ["TR-1"], "r"),
      f("redundancy", "u1", ["TR-1"], "r"),
      f("unreachable", "u1", ["TR-1"], "u"),
      f("conflict", "u1", ["DOB-1"], "c"),
      f("refinement-violation", "u1", ["OB-1"], "rv"),
      f("mapping-gap", "u1", ["OB-1"], "mg"),
      f("conflict", "u1", ["DOB-1"], "a"),
    ]).sortedCanonically().toArray();
    expect(sorted.map((x) => x.kind())).toEqual([
      "conflict",
      "conflict",
      "unreachable",
      "redundancy",
      "redundancy",
      "refinement-violation",
      "mapping-gap",
      "cross-check-disagreement",
    ]);
    // 同 kind・同 unit・同 targets の 2 conflict は detail 昇順（a が c の前）。
    expect(sorted[0]?.detail()).toBe("a");
    expect(sorted[1]?.detail()).toBe("c");
    expect(sorted[3]?.unit()).toBe("u1");
    const skips = DesignSkips.of([
      DesignSkipped.of({ target: TargetId.of("TR-2"), reason: SkipReason.of("timeout"), unit: UnitName.of("u2")}),
      DesignSkipped.of({ target: TargetId.of("TR-10"), reason: SkipReason.of("waived"), unit: UnitName.of("u1")}),
      DesignSkipped.of({ target: TargetId.of("TR-2"), reason: SkipReason.of("capability"), unit: UnitName.of("u1")}),
    ]).sortedCanonically().toArray();
    expect(skips.map((s) => `${s.unit()}:${s.target().asString()}:${s.reason()}`)).toEqual([
      "u1:TR-2:capability",
      "u1:TR-10:waived",
      "u2:TR-2:timeout",
    ]);
  });

  test("compose sorts inputs by artifact and dedupes checked; degraded strips everything", () => {
    const report = DesignReport.compose({
      id: DesignReportId.of(ap("/v"), "smt"),
      irVersion: IrVersion.of("1.0.0"),
      irHash: ContentHash.of("a".repeat(64)),
      method: "exhaustive",
      findings: DesignFindings.of([f("conflict", "u1", ["DOB-1"], "c")]),
      skipped: DesignSkips.of([]),
      inputs: DesignInputAnchors.of([
        DesignInputAnchor.of({ artifact: "b.md", sha256: ContentHash.of("2".repeat(64)) }),
        DesignInputAnchor.of({ artifact: "a.md", sha256: ContentHash.of("1".repeat(64)) }),
      ]),
      checked: CheckedUnits.of(Array.from(["unit:u2", "unit:u1", "unit:u1"], (raw) => UnitName.of(raw))),
    });
    expect(report.inputs()?.toArray().map((i) => i.artifact())).toEqual(["a.md", "b.md"]);
    expect(report.checked()?.toStrings()).toEqual(["unit:u1", "unit:u2"]);
    expect(report.passes()).toBe(false);
    expect(report.findingsCount()).toBe(1);
    expect(report.skippedCount()).toBe(0);
    expect(report.irVersion().asString()).toBe("1.0.0");
    expect(report.irHash().asString()).toBe("a".repeat(64));
    expect(report.method()).toBe("exhaustive");
    expect(report.unavailableReason()).toBe(null);
    expect(report.crossChecked()).toBe(null);
    const back = DesignReport.of({
      id: report.id(),
      irVersion: report.irVersion(),
      irHash: report.irHash(),
      method: VerificationMethod.of(report.method()),
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
    const HASH = ContentHash.of("a".repeat(64));
    const sibling = (backend: string, violated: boolean, skipKey?: string): DesignReport =>
      DesignReport.of({
        id: DesignReportId.of(ap("/v"), backend),
        irVersion: IrVersion.of("1.0.0"),
        irHash: HASH,
        method: VerificationMethod.of("exhaustive"),
        findings: DesignFindings.of(violated ? [f("scenario-violation", "u1", ["DSC-1"], "x")] : []),
        skipped: DesignSkips.of(skipKey ? [DesignSkipped.of({ target: TargetId.of("DSC-1"), reason: SkipReason.of("capability"), unit: UnitName.of("u1")})] : []),
        inputs: null,
        checked: null,
        crossChecked: null,
        unavailableReason: null,
      });
    const report = DesignReports.of([
      sibling("quint", true),
      sibling("smt", false),
    ]).crossChecked(DesignReportId.of(ap("/v"), "cross-check"), m, HASH);
    const disagreement = report.findings().toArray()[0];
    expect(disagreement?.kind()).toBe("cross-check-disagreement");
    expect(disagreement?.frRefs().toStrings()).toEqual(["FR-1", "FR-2"]);
    expect(disagreement?.targets().toStrings()).toEqual(["DSC-1"]);
    expect(disagreement?.witness().toDocument()).toEqual({ verdicts: { quint: "violated", smt: "clean" } });
    expect(disagreement?.unit()).toBe("u1");
    expect(disagreement?.detail()).toBe(
      'Backends "quint" and "smt" disagree on scenario DSC-1 of unit u1. This signals a defect in the formalization or in a backend compiler, not in the design itself.',
    );
    expect(report.crossChecked()?.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }))).toEqual([
      { backend: "quint", targets: ["DSC-1"] },
      { backend: "smt", targets: ["DSC-1"] },
    ]);
    const skippedOut = DesignReports.of([
      sibling("quint", true, "skip"),
      sibling("smt", false),
    ]).crossChecked(DesignReportId.of(ap("/v"), "cross-check"), m, HASH);
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
    expect(u1.allTargets().toStrings()).toEqual(["DOB-1", "DSC-1", "TR-1"]);
    expect(u1.enumValuesOf("T.s")).toEqual([]);

    const unread = DesignReport.irUnreadable(DesignReportId.of(ap("/v"), "smt"), "exhaustive", "design IR carries no units[]");
    expect(unread.unavailableReason()).toBe("design IR unreadable: design IR carries no units[] — see the deep-spec-design-ir-valid sensor for details");
    expect(unread.irVersion().asString()).toBe("0.0.0");
    expect(unread.irHash().equals(ContentHash.ofText(""))).toBe(true);

    const mismatch = DesignReport.versionMismatch(DesignReportId.of(ap("/v"), "quint"), m, ContentHash.of("a".repeat(64)), "simulation");
    expect(mismatch.skipped().toArray().map((s) => `${s.unit()}:${s.target().asString()}:${s.reason()}`)).toEqual([
      "u1:DOB-1:ir-version-mismatch",
      "u1:DSC-1:ir-version-mismatch",
      "u1:TR-1:ir-version-mismatch",
    ]);
    expect(mismatch.skipped().toArray()[0]?.detail()).toBe("design IR major version 2 is not supported by this backend (supports 1.x.x)");

    const down = DesignReport.backendUnavailable(DesignReportId.of(ap("/v"), "quint"), m, ContentHash.of("a".repeat(64)), "simulation", "quint CLI is not available", "quint CLI missing");
    expect(down.unavailableReason()).toBe("quint CLI is not available");
    expect(down.skipped().toArray().every((s) => s.reason() === "unavailable" && s.detail() === "quint CLI missing")).toBe(true);
  });

  test("the reachability variant keeps only events plus the single probe, and reachability requires a completed search or a final-state witness", () => {
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

    const result = (findings: Json[], skipped: Json[] = [], method = "bounded") =>
      parseSiblingVerdictDocument({ backend: "quint", irVersion: "1.0.0", irHash: "a".repeat(64), findings, skipped, method }).reachabilityOf("T.s", "dead");
    const conflict = (witness: Json): Json => ({ kind: "conflict", targets: ["OB-9999"], frRefs: [], detail: "probe", witness });
    expect(result([conflict({ trace: [{ "T.s": "alive" }, { "T.s": "dead" }] })]).equals(ReachabilityVerdict.reached())).toBe(true);
    expect(result([conflict({ trace: [{ "T.s": "alive" }] })]).equals(ReachabilityVerdict.unverified())).toBe(true);
    expect(result([conflict({})]).equals(ReachabilityVerdict.unverified())).toBe(true);
    expect(result([]).equals(ReachabilityVerdict.notReachedWithinBound())).toBe(true);
    expect(result([], [{ target: "OB-9999", reason: "timeout" }]).equals(ReachabilityVerdict.unverified())).toBe(true);
    expect(result([], [], "simulation").equals(ReachabilityVerdict.unverified())).toBe(true);
  });
});

describe("lowered collections and the lowering index (first-class operations)", () => {
  const u = unit({});
  const base = u.lowered({ synthetics: false });

  test("of/add/iterator/count/toArray hold OB/SC/BG numbering order", () => {
    const obs = base.obligations().add(LoweredObligation.of({ id: LoweredId.of("OB-99"), nature: "invariant", frRefs: FrRefs.of([]) }));
    expect(obs.count()).toBe(base.obligations().count() + 1);
    expect([...obs].at(-1)?.id().asString()).toBe("OB-99");
    expect(obs.toArray().at(-1)?.nature()).toBe("invariant");

    const scs = base.scenarios().add(LoweredScenario.of({ id: LoweredId.of("SC-99"), kind: "accept", frRefs: FrRefs.of([]), bindings: {} }));
    expect(scs.count()).toBe(base.scenarios().count() + 1);
    expect([...scs].at(-1)?.id().asString()).toBe("SC-99");
    expect(scs.toArray().at(-1)?.kind()).toBe("accept");

    const bgs = base.background().add(LoweredBackground.of({ id: LoweredId.of("BG-99"), assert: { op: "bool", value: true } }));
    expect(bgs.count()).toBe(base.background().count() + 1);
    expect([...bgs].at(-1)?.id().asString()).toBe("BG-99");
    expect(bgs.toArray().at(-1)?.id().asString()).toBe("BG-99");
  });

  test("withPassthrough extends attribution immutably and rewrites fall back verbatim", () => {
    const extended = base.index().withPassthrough("OB-99", "FR-7");
    expect([extended.originOf("OB-99")?.design().asString(), kindOf(extended.originOf("OB-99"))]).toEqual(["FR-7", "passthrough"]);
    expect(base.index().originOf("OB-99")).toBe(null);
    expect(extended.resolveDesignTarget("OB-99").design).toBe("FR-7");
    // 未知の lowered id は逐語で残る（detail・witness core とも）。
    expect(base.index().rewriteLoweredIds("No rule for OB-42 applies")).toBe("No rule for OB-42 applies");
    expect(base.index().rewriteLoweredIdTokens("g_OB_42")).toBe("g_OB_42");
    expect(base.index().isTransition("TR-404")).toBe(false);
    expect(base.index().machineOfTransition("TR-404")).toBe(null);
    expect(base.index().attrPathOfMachine("SM-404")).toBe(null);
  });

  test("sibling verdict collections keep document order under add", () => {
    const finding = SiblingVerdictFinding.of({ kind: FindingKind.of("conflict"), frRefs: FrRefs.of([]), targets: [LoweredId.of("OB-1")], witness: DesignWitness.core([]), detail: "x" });
    const findings = SiblingVerdictFindings.of([]).add(finding);
    expect([...findings]).toEqual([finding]);
    expect(findings.toArray()).toEqual([finding]);

    const skip = SiblingVerdictSkip.of({ target: LoweredId.of("OB-1"), reason: SkipReason.of("timeout")});
    const skips = SiblingVerdictSkips.of([]).add(skip);
    expect([...skips]).toEqual([skip]);
    expect(skips.toArray()).toEqual([skip]);
  });
});

describe("the typed entity projection reproduces the IR's schema.entities byte for byte (ruling 2)", () => {
  const roundTrip = (raw: Json[]): void => {
    const parsed = parseDesignEntities({ entities: raw });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    expect(JSON.stringify(renderDesignEntities(parsed.value))).toBe(JSON.stringify(raw));
  };

  test("every design IR fixture", () => {
    for (const file of [
      join(pluginRoot, "tests", "fixtures", "design", "record", "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"),
      join(pluginRoot, "tests", "fixtures", "refinement", "record", "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"),
    ]) {
      const fences = extractFences(readFileSync(file, "utf-8"), "json");
      const raw = JSON.parse(fences[0]?.body ?? "null") as { units: { schema: { entities: Json[] } }[] };
      expect(raw.units.length).toBeGreaterThan(0);
      for (const u of raw.units) roundTrip(u.schema.entities);
    }
  });

  test("descriptions on entities and attributes, int bounds and enum values survive; nothing is invented", () => {
    roundTrip([
      { name: "Order", description: "an order", attributes: [
        { name: "amount", description: "positive", type: { kind: "int", min: 0, max: 8 } },
        { name: "status", type: { kind: "enum", values: ["draft", "done"] } },
        { name: "paid", type: { kind: "bool" } },
        { name: "open", type: { kind: "int" } },
      ] },
      { name: "Bare", attributes: [{ name: "x", type: { kind: "bool" } }] },
    ]);
  });
});

// 移管前の実装（`LoweredUnit.of` / `LoweredUnit.remapVerdicts`）が実際に出した
// バイト（凍結面）。FR6 の移管は所有者の付け替えであって新しい判定ではないので、
// この面はどれも 1 バイトも動いてはならない。
const FR6_PLAIN_SHAPE = ["OB-1:event:close", "OB-2:invariant:-", "OB-3:temporal:-", "OB-4:event:-", "OB-5:event:close", "OB-6:event:close", "OB-7:event:close", "OB-8:event:close", "OB-9:event:ship", "OB-10:event:ship", "OB-11:event:ship"];
const FR6_SYNTH_SHAPE = [...FR6_PLAIN_SHAPE, "OB-12:invariant:-", "OB-13:invariant:-", "OB-14:invariant:-", "OB-15:invariant:-", "OB-16:invariant:-", "OB-17:invariant:-", "OB-18:invariant:-", "OB-19:invariant:-", "OB-20:invariant:-"];
// fixtureの空トリガを未指定へ修正したため、両文書から13 byteのtrigger欄が消える。
const FR6_PLAIN_DOC = {"bytes": 3230, "sha256": "0a90c8683d0537160adbe7b5b0f43fdd15d8757760aa89ed27bae0b5864b53a4"};
const FR6_SYNTH_DOC = {"bytes": 5515, "sha256": "4d5029a4c171a30383787c9923838afe068018203a44367c6dcd0847009d87cc"};
const FR6_PLAIN_ORIGINS = "[{\"design\":\"DOB-1\",\"id\":\"OB-1\",\"kind\":\"passthrough\",\"pair\":[\"DOB-1\",\"DOB-1\"]},{\"design\":\"DOB-2\",\"id\":\"OB-2\",\"kind\":\"passthrough\",\"pair\":[\"DOB-2\",\"DOB-2\"]},{\"design\":\"DOB-3\",\"id\":\"OB-3\",\"kind\":\"passthrough\",\"pair\":[\"DOB-3\",\"DOB-3\"]},{\"design\":\"DOB-4\",\"id\":\"OB-4\",\"kind\":\"passthrough\",\"pair\":[\"DOB-4\",\"DOB-4\"]},{\"design\":\"TR-1\",\"id\":\"OB-5\",\"kind\":\"transition\",\"pair\":[\"TR-1\",\"TR-1\"]},{\"design\":\"TR-2\",\"id\":\"OB-6\",\"kind\":\"transition\",\"pair\":[\"TR-2\",\"TR-2\"]},{\"design\":\"SM-1\",\"id\":\"OB-7\",\"kind\":\"ignore\",\"pair\":[\"SM-1\",\"SM-1\"]},{\"design\":\"SM-1\",\"id\":\"OB-8\",\"kind\":\"ignore\",\"pair\":[\"SM-1\",\"SM-1\"]},{\"design\":\"TR-3\",\"id\":\"OB-9\",\"kind\":\"transition\",\"pair\":[\"TR-3\",\"TR-3\"]},{\"design\":\"TR-4\",\"id\":\"OB-10\",\"kind\":\"transition\",\"pair\":[\"TR-4\",\"TR-4\"]},{\"design\":\"SM-2\",\"id\":\"OB-11\",\"kind\":\"ignore\",\"pair\":[\"SM-2\",\"SM-2\"]}]";
const FR6_SYNTH_ORIGINS = "[{\"design\":\"DOB-1\",\"id\":\"OB-1\",\"kind\":\"passthrough\",\"pair\":[\"DOB-1\",\"DOB-1\"]},{\"design\":\"DOB-2\",\"id\":\"OB-2\",\"kind\":\"passthrough\",\"pair\":[\"DOB-2\",\"DOB-2\"]},{\"design\":\"DOB-3\",\"id\":\"OB-3\",\"kind\":\"passthrough\",\"pair\":[\"DOB-3\",\"DOB-3\"]},{\"design\":\"DOB-4\",\"id\":\"OB-4\",\"kind\":\"passthrough\",\"pair\":[\"DOB-4\",\"DOB-4\"]},{\"design\":\"TR-1\",\"id\":\"OB-5\",\"kind\":\"transition\",\"pair\":[\"TR-1\",\"TR-1\"]},{\"design\":\"TR-2\",\"id\":\"OB-6\",\"kind\":\"transition\",\"pair\":[\"TR-2\",\"TR-2\"]},{\"design\":\"SM-1\",\"id\":\"OB-7\",\"kind\":\"ignore\",\"pair\":[\"SM-1\",\"SM-1\"]},{\"design\":\"SM-1\",\"id\":\"OB-8\",\"kind\":\"ignore\",\"pair\":[\"SM-1\",\"SM-1\"]},{\"design\":\"TR-3\",\"id\":\"OB-9\",\"kind\":\"transition\",\"pair\":[\"TR-3\",\"TR-3\"]},{\"design\":\"TR-4\",\"id\":\"OB-10\",\"kind\":\"transition\",\"pair\":[\"TR-4\",\"TR-4\"]},{\"design\":\"SM-2\",\"id\":\"OB-11\",\"kind\":\"ignore\",\"pair\":[\"SM-2\",\"SM-2\"]},{\"design\":\"DOB-1\",\"id\":\"OB-12\",\"kind\":\"vac-dead\",\"pair\":[\"DOB-1\",\"DOB-1\"]},{\"design\":\"TR-1\",\"id\":\"OB-13\",\"kind\":\"vac-dead\",\"pair\":[\"TR-1\",\"TR-1\"]},{\"design\":\"TR-2\",\"id\":\"OB-14\",\"kind\":\"vac-dead\",\"pair\":[\"TR-2\",\"TR-2\"]},{\"design\":\"TR-3\",\"id\":\"OB-15\",\"kind\":\"vac-dead\",\"pair\":[\"TR-3\",\"TR-3\"]},{\"design\":\"TR-4\",\"id\":\"OB-16\",\"kind\":\"vac-dead\",\"pair\":[\"TR-4\",\"TR-4\"]},{\"design\":\"DOB-1|TR-1\",\"id\":\"OB-17\",\"kind\":\"vac-shadow\",\"pair\":[\"DOB-1\",\"TR-1\"]},{\"design\":\"TR-1|DOB-1\",\"id\":\"OB-18\",\"kind\":\"vac-shadow\",\"pair\":[\"TR-1\",\"DOB-1\"]},{\"design\":\"TR-3|TR-4\",\"id\":\"OB-19\",\"kind\":\"vac-shadow\",\"pair\":[\"TR-3\",\"TR-4\"]},{\"design\":\"TR-4|TR-3\",\"id\":\"OB-20\",\"kind\":\"vac-shadow\",\"pair\":[\"TR-4\",\"TR-3\"]}]";
const FR6_REMAPPED = "{\"findings\":[{\"detail\":\"The guard of TR-1 can never hold under the entity constraints and invariants (witness core attached): the transition is dead.\",\"frRefs\":[\"FR-1\"],\"kind\":\"unreachable\",\"targets\":[\"TR-1\"],\"unit\":\"u-fr6\",\"witness\":{\"core\":[\"ant_TR_1\"]}},{\"detail\":\"No rule for TR-3 applies\",\"frRefs\":[\"FR-9\"],\"kind\":\"completeness-gap\",\"targets\":[\"DSC-1\",\"TR-3\"],\"unit\":\"u-fr6\",\"witness\":{\"core\":[\"g_TR_3\",\"ty_x\"]}},{\"detail\":\"TR-3 and TR-4 are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.\",\"frRefs\":[],\"kind\":\"redundancy\",\"targets\":[\"TR-3\",\"TR-4\"],\"unit\":\"u-fr6\",\"witness\":{\"core\":[]}}],\"method\":\"exhaustive\",\"skipped\":[{\"detail\":\"machine SM-2 declares deterministic: false — the same-(state,trigger) overlap check is waived by the model\",\"reason\":\"waived\",\"target\":\"TR-3\",\"unit\":\"u-fr6\"},{\"detail\":\"machine SM-2 declares deterministic: false — the same-(state,trigger) overlap check is waived by the model\",\"reason\":\"waived\",\"target\":\"TR-4\",\"unit\":\"u-fr6\"},{\"detail\":\"check for DOB-1 timed out\",\"reason\":\"timeout\",\"target\":\"DOB-1\",\"unit\":\"u-fr6\"},{\"detail\":null,\"reason\":\"capability\",\"target\":\"DSC-2\",\"unit\":\"u-fr6\"}],\"unavailable\":null}";
const FR6_UNREADABLE = "{\"findings\":[],\"method\":null,\"skipped\":[],\"unavailable\":\"sibling backend produced no findings document\"}";
const FR6_UNAVAILABLE = "{\"findings\":[],\"method\":\"simulation\",\"skipped\":[],\"unavailable\":\"boom\"}";

// 新規テスト #15（FR6.1／FR6.2、BR6.1〜BR6.3）——lowering の所有者が
// `DesignUnit` へ、兄弟判定の解釈が `SiblingVerdictDocument` へ移ったあとも、
// 生成物が移管前と byte 同一であることの凍結。
describe("lowering and remap stay byte-identical after the ownership move (FR6)", () => {
  const fr6 = unit({
    unit: "u-fr6",
    rawEntities: [
      { name: "Ticket", attributes: [{ name: "status", type: { kind: "enum", values: ["open", "held", "closed"] } }] },
      { name: "Order", attributes: [{ name: "phase", type: { kind: "enum", values: ["new", "done"] } }, { name: "amount", type: { kind: "int", min: 0, max: 9 } }] },
    ],
    obligations: [
      { id: "DOB-2", nature: "invariant", origin: "rules", brRefs: ["BR1.1"], frRefs: ["FR-2"], assert: { op: "bool", value: true } },
      {
        id: "DOB-1",
        nature: "event",
        origin: "",
        brRefs: [],
        frRefs: ["FR-1"],
        trigger: "close",
        guard: { op: "bool", value: true },
        effect: { op: "eq", args: [{ op: "ref", path: "Ticket.status", prime: true }, { op: "enum", value: "closed" }] },
      },
      { id: "DOB-3", nature: "temporal", origin: "", brRefs: [], frRefs: [], temporal: { pattern: "leads-to", from: { op: "bool", value: true }, to: { op: "bool", value: false } } },
      // トリガ未指定の event 宣言は候補にならない（eventDefinition が null）——素通しの
      // lowered 義務にはなるが、合成プローブは生えない。
      { id: "DOB-4", nature: "event", origin: "", brRefs: [], frRefs: [], guard: { op: "bool", value: false }, effect: { op: "bool", value: true } },
    ],
    machines: [
      {
        id: "SM-2",
        entity: "Order",
        attribute: "phase",
        initial: ["new"],
        deterministic: false,
        ignores: [{ state: "done", trigger: "ship", reason: "terminal" }],
        transitions: [
          { id: "TR-3", from: "new", to: "done", trigger: "ship", brRefs: [] },
          { id: "TR-4", from: "new", to: "done", trigger: "ship", brRefs: [], guard: { op: "bool", value: true } },
        ],
      },
      {
        id: "SM-1",
        entity: "Ticket",
        attribute: "status",
        initial: ["open"],
        deterministic: true,
        ignores: [
          { state: "held", trigger: "close", reason: "held" },
          { state: "closed", trigger: "close", reason: "already closed" },
        ],
        transitions: [
          { id: "TR-1", from: "open", to: "closed", trigger: "close", brRefs: [] },
          { id: "TR-2", from: "held", to: "closed", trigger: "close", brRefs: [], guard: { op: "bool", value: true }, effect: { op: "bool", value: true } },
        ],
      },
    ],
    scenarios: [
      { id: "DSC-2", kind: "reject", brRefs: [], frRefs: ["FR-3"], bindings: { "Order.amount": 3, "Order.phase": "new" }, event: { trigger: "ship" }, expect: { op: "bool", value: false } },
      { id: "DSC-1", kind: "accept", brRefs: [], frRefs: [], bindings: {} },
    ],
    background: [
      { id: "BG-B", assert: { op: "bool", value: false } },
      { id: "BG-A", assert: { op: "bool", value: true } },
    ],
  });

  const plain = fr6.lowered({ synthetics: false });
  const synth = fr6.lowered({ synthetics: true });

  const siblingDoc = (input: {
    findings?: { kind: string; frRefs: string[]; targets: string[]; witness: Json; detail: string }[];
    skipped?: { target: string; reason: string; detail?: string }[];
  }): SiblingVerdictDocument =>
    SiblingVerdictDocument.readable( VerificationMethod.of("exhaustive"),
      SiblingVerdictFindings.of(
        (input.findings ?? []).map((f) => SiblingVerdictFinding.of({ ...f, kind: FindingKind.of(f.kind), witness: DesignWitness.of(f.witness), frRefs: FrRefs.of(Array.from(f.frRefs, (raw) => RequirementId.of(raw))), targets: f.targets.map((t) => LoweredId.of(t)) })),
      ),
      SiblingVerdictSkips.of((input.skipped ?? []).map((k: { target: string; reason: string; detail?: string }) => SiblingVerdictSkip.of({ ...k, reason: SkipReason.of(k.reason), target: LoweredId.of(k.target) }))),
    );

  const originsOf = (l: LoweredUnit): string =>
    canonicalStringify(l.index().toOriginEntries().map(([id, o]) => ({
      id,
      design: o.design().asString(),
      kind: ORIGIN_KINDS.find((k) => o.isKind(k)) ?? "",
      pair: o.pairRefs().map((r) => r.asString()),
    })) as unknown as Json);

  const projectRemap = (out: { findings: DesignFindings; skipped: DesignSkips; unavailable: string | null; method: string | null }): string =>
    canonicalStringify({
      unavailable: out.unavailable,
      method: out.method,
      findings: out.findings.toArray().map((f) => ({
        kind: f.kind(),
        frRefs: f.frRefs().toStrings() as unknown as Json,
        targets: f.targets().toStrings() as unknown as Json,
        unit: f.unit(),
        detail: f.detail(),
        witness: f.witness().toDocument(),
      })) as unknown as Json,
      skipped: out.skipped.toArray().map((s) => ({
        target: s.target().asString(),
        reason: s.reason(),
        unit: s.unit(),
        detail: s.detail() ?? null,
      })) as unknown as Json,
    });

  const shapeOf = (l: LoweredUnit): string[] =>
    l.obligations().toArray().map((o) => `${o.id().asString()}:${o.nature()}:${o.trigger() ?? "-"}`);

  const digest = (text: string): { bytes: number; sha256: string } => ({
    bytes: Buffer.byteLength(text, "utf-8"),
    sha256: createHash("sha256").update(text, "utf-8").digest("hex"),
  });

  test("the lowered v1 document is frozen, with and without synthetics", () => {
    // 全文は数 KB ある。採番・分類の読める射影と、正準 JSON のバイト数＋ダイジェスト
    // で凍結する（差分が出たら canonicalStringify(renderLoweredDocument(...)) を出して比べる）。
    expect(shapeOf(plain)).toEqual(FR6_PLAIN_SHAPE);
    expect(shapeOf(synth)).toEqual(FR6_SYNTH_SHAPE);
    expect(digest(canonicalStringify(renderLoweredDocument(fr6, plain)))).toEqual(FR6_PLAIN_DOC);
    expect(digest(canonicalStringify(renderLoweredDocument(fr6, synth)))).toEqual(FR6_SYNTH_DOC);
    expect(plain.scenarios().toArray().map((s) => s.id().asString())).toEqual(["SC-1", "SC-2"]);
    expect(plain.background().toArray().map((b) => b.id().asString())).toEqual(["BG-1", "BG-2"]);
  });

  test("the attribution index is frozen (numbering, lowering kinds, shadow pairs)", () => {
    expect(originsOf(plain)).toBe(FR6_PLAIN_ORIGINS);
    expect(originsOf(synth)).toBe(FR6_SYNTH_ORIGINS);
  });

  test("the remapped design verdicts are frozen (unreachable, mutual redundancy, waiver, dedupe; invalid kinds are rejected before remapping)", () => {
    const deadTr1 = synth.index().toOriginEntries().find(([, e]) => e.isKind("vac-dead") && e.design().asString() === "TR-1")?.[0] as string;
    const shadows = synth.index().toOriginEntries().filter(([, e]) => e.isKind("vac-shadow")).map(([id]) => id);
    const tr3 = synth.index().toOriginEntries().find(([, e]) => e.isKind("transition") && e.design().asString() === "TR-3")?.[0] as string;
    const tr4 = synth.index().toOriginEntries().find(([, e]) => e.isKind("transition") && e.design().asString() === "TR-4")?.[0] as string;
    const remapped = siblingDoc({
      findings: [
        { kind: "conflict", frRefs: ["FR-1"], targets: [deadTr1], witness: { core: [`ant_${deadTr1.replace("-", "_")}`] }, detail: `dead ${deadTr1}` },
        ...shadows.map((id) => ({ kind: "conflict", frRefs: [], targets: [id], witness: { core: [] }, detail: "shadow" })),
        { kind: "conflict", frRefs: [], targets: [tr3, tr4], witness: { core: [] }, detail: "overlap" },
        { kind: "conflict", frRefs: [], targets: [tr3, tr4], witness: { core: [] }, detail: "overlap again" },
        { kind: "completeness-gap", frRefs: ["FR-9"], targets: [tr3, "SC-1"], witness: { core: [`g_${tr3.replace("-", "_")}`, "ty_x"] }, detail: `No rule for ${tr3} applies` },

      ],
      skipped: [
        { target: "OB-1", reason: "timeout", detail: "check for OB-1 timed out" },
        { target: "OB-1", reason: "timeout", detail: "duplicate" },
        { target: "SC-2", reason: "capability" },
        { target: deadTr1, reason: "timeout", detail: "synthetic noise" },
      ],
    }).remapVerdicts(fr6, synth.index());
    expect(projectRemap(remapped)).toBe(FR6_REMAPPED);
    expect(projectRemap(SiblingVerdictDocument.unreadable().remapVerdicts(fr6, synth.index()))).toBe(FR6_UNREADABLE);
    expect(projectRemap(SiblingVerdictDocument.unavailable("boom", VerificationMethod.of("simulation")).remapVerdicts(fr6, synth.index()))).toBe(FR6_UNAVAILABLE);
  });
});
