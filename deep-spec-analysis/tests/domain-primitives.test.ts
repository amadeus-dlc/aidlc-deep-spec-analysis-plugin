// strict creation（parse／名前付きファクトリ）と tolerant hydration
// （reconstitute）の分離——VerificationMethod・SkipReason・FindingKind と、
// FindingKind を持つ 3 つの finding 記録についての単体試験（種別規律の裁定
// 3-2、2026-09-04）。
//
//   - BR3.1: strict creation は未知値を Result のエラーにし、domain object を
//     生成しない（finding の正常生成口は検証済み FindingKind だけを受け取る——
//     生の string は型で弾かれる。`@ts-expect-error` の検査は `bunx tsc
//     --noEmit` が担い、口が緩めば未使用ディレクティブとして落ちる）
//   - BR3.2: tolerant hydration は未知値を逐語保持し、既存どおり降格でき、
//     例外を投げない

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "@deep-spec/kernel-adapter";
import {
  DesignFinding,
  DesignFindings,
  DesignReport,
  DesignReportId,
  DesignReports,
  DesignSkipped,
  DesignSkips,
  DesignVerifyDirectory,
  DesignWitness,
} from "@deep-spec/design-domain";
import { ArtifactPath, FindingKind, FindingsSchema, FrRefs, IrVersion, ContentHash, SkipReason, TargetId, TargetIds, VerificationMethod } from "@deep-spec/kernel-domain";
import {
  VerificationDirectory,
  VerificationFinding,
  VerificationFindings,
  VerificationReport,
  VerificationReportId,
  VerificationReports,
  VerificationSkips,
  VerificationWitness,
} from "@deep-spec/requirements-domain";
import { Finding, Findings, InputAnchors, ReferenceCheckReport, ReferenceCheckReportId, Skips, WitnessRefs } from "@deep-spec/refcheck-domain";
import { ReferenceCheckReportRepositoryImpl } from "@deep-spec/refcheck-adapter";

const findingsSchemaPath = join(
  dirname(fileURLToPath(import.meta.url)), "..", "src", "entries", "data", "deep-spec-findings-schema.json",
);

// テスト用: 検証済みパス VO の短縮構築（tmpdir パスは常に非空）。
function refcheckPath(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

const KNOWN_METHODS = ["exhaustive", "bounded", "simulation", "static"];
const KNOWN_SKIP_REASONS = [
  "unavailable",
  "timeout",
  "capability",
  "compile-error",
  "waived",
  "absent-input",
  "stale-input",
  "ir-version-mismatch",
  "unrecognized-format",
];


// テスト用: 設計 report の短縮構築（識別と method 以外は空）。
function designPath(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

function reportOf(directory: ArtifactPath, backend: string, method = "exhaustive"): DesignReport {
  return DesignReport.compose({
    id: DesignReportId.of(directory, backend),
    irVersion: IrVersion.reconstitute("1.0.0"),
    irHash: ContentHash.ofText("ir"),
    method,
    findings: DesignFindings.of([]),
    skipped: DesignSkips.of([]),
  });
}

function designReportOf(findings: readonly DesignFinding[]): DesignReport {
  const directory = designPath("/records/deep-spec-design-verify");
  return DesignReport.compose({
    id: DesignReportId.of(directory, "smt"),
    irVersion: IrVersion.reconstitute("1.0.0"),
    irHash: ContentHash.ofText("ir"),
    method: "exhaustive",
    findings: DesignFindings.of(findings),
    skipped: DesignSkips.of([]),
  });
}

describe("strict creation rejects unknown closed-set values (BR3.1)", () => {
  test("VerificationMethod.parse errors on an unknown method and produces no domain object", () => {
    const result = VerificationMethod.parse("no-such-method");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable: parse must reject an unknown method");
    expect(result.error).toEqual({ kind: "unknown-verification-method", raw: "no-such-method" });
    for (const method of KNOWN_METHODS) {
      const ok = VerificationMethod.parse(method);
      expect(ok.ok).toBe(true);
      if (ok.ok) expect(ok.value.asString()).toBe(method);
    }
  });

  test("SkipReason.parse errors on an unknown reason and produces no domain object", () => {
    const result = SkipReason.parse("no-such-reason");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable: parse must reject an unknown reason");
    expect(result.error).toEqual({ kind: "unknown-skip-reason", raw: "no-such-reason" });
    for (const reason of KNOWN_SKIP_REASONS) {
      const ok = SkipReason.parse(reason);
      expect(ok.ok).toBe(true);
      if (ok.ok) expect(ok.value.value()).toBe(reason);
    }

    // 名前付きファクトリはすべて閉集合の中の値を返す——domain／usecase が
    // 未知 reason を生成する経路がないことを、閉集合の門と突き合わせて確かめる。
    const factories: readonly SkipReason[] = [
      SkipReason.unavailable(),
      SkipReason.timeout(),
      SkipReason.capability(),
      SkipReason.compileError(),
      SkipReason.waived(),
      SkipReason.absentInput(),
      SkipReason.staleInput(),
      SkipReason.irVersionMismatch(),
      SkipReason.unrecognizedFormat(),
    ];
    expect(factories.map((r) => r.value())).toEqual(KNOWN_SKIP_REASONS);
    for (const reason of factories) expect(SkipReason.parse(reason.value()).ok).toBe(true);
  });
});

describe("tolerant hydration preserves unknown values verbatim without throwing (BR3.2)", () => {
  test("VerificationMethod.reconstitute never throws and keeps an unknown method verbatim", () => {
    const method = VerificationMethod.reconstitute("no-such-method");
    expect(method.asString()).toBe("no-such-method");
    expect(method.equals(VerificationMethod.reconstitute("no-such-method"))).toBe(true);
    expect(method.equals(VerificationMethod.reconstitute("exhaustive"))).toBe(false);
  });

  test("SkipReason.reconstitute never throws and keeps an unknown reason verbatim", () => {
    const reason = SkipReason.reconstitute("no-such-reason");
    expect(reason.value()).toBe("no-such-reason");
    expect(reason.compareTo(SkipReason.reconstitute("no-such-reason"))).toBe(0);
    expect(reason.compareTo(SkipReason.reconstitute("zzz-after"))).toBeLessThan(0);
  });

  test("DesignSkipped keeps degrading on an unrecognized reason through reconstitute (existing written-document behavior)", () => {
    const degraded = DesignSkipped.reconstitute({
      target: TargetId.reconstitute("TR-1"),
      reason: "no-such-reason",
      unit: "u1",
      detail: "written by a future backend version",
    });
    expect(degraded.reason()).toBe("no-such-reason");
    expect(degraded.unit()).toBe("u1");
    expect(degraded.detail()).toBe("written by a future backend version");
  });
});

// finding kind の strict creation / tolerant hydration（FR3.2／FR3.3／FR3.4）。
//
//   - BR3.1: 正常生成口（`DesignFinding.of` / `VerificationFinding.of` /
//     refcheck `Finding.of`）は検証済みの `FindingKind` しか受け取らない——
//     未知 kind は型で弾かれ、閉集合の門 `FindingKind.parse` は Result の
//     error になる
//   - BR3.2: 書かれた文書の未知 kind は adapter の hydration が逐語で運び、
//     既知のどれよりも後ろへ並べたまま降格する（凍結挙動）
describe("finding kind の strict creation は未知 kind を受け付けない (BR3.1)", () => {
  test("正常生成口は FindingKind しか受け取らず、閉集合の門は未知 kind を Result の error にする", () => {
    const unknown = FindingKind.parse("no-such-kind");
    expect(unknown.ok).toBe(false);
    if (unknown.ok) throw new Error("unreachable: parse must reject an unknown finding kind");
    expect(unknown.error).toEqual({ kind: "unknown-finding-kind", raw: "no-such-kind" });

    // 名前付きファクトリはすべて閉集合の中の値を返す——正常生成口へ未知 kind が
    // 紛れ込む経路がないことを、正準順位表と突き合わせて確かめる。
    const factories: readonly FindingKind[] = [
      FindingKind.conflict(),
      FindingKind.completenessGap(),
      FindingKind.scenarioViolation(),
      FindingKind.unreachable(),
      FindingKind.redundancy(),
      FindingKind.refinementViolation(),
      FindingKind.mappingGap(),
      FindingKind.structureInvalid(),
      FindingKind.referenceBroken(),
      FindingKind.consistencyMismatch(),
      FindingKind.crossCheckDisagreement(),
    ];
    expect(factories.map((k) => k.asString())).toEqual([...FindingKind.canonicalOrder()]);
    for (const kind of factories) expect(FindingKind.parse(kind.asString()).ok).toBe(true);

    // 生の string は 3 クラスのどの正常生成口にも渡らない（型で弾かれる）。
    const designProps = { frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["OB-1"]), witness: DesignWitness.core([]), unit: "u1", detail: "d" };
    // @ts-expect-error 正常生成口は検証済みの FindingKind だけを受け取る
    DesignFinding.of({ kind: "no-such-kind", ...designProps });
    // @ts-expect-error 正常生成口は検証済みの FindingKind だけを受け取る
    VerificationFinding.of({ kind: "no-such-kind", frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["OB-1"]), witness: VerificationWitness.core([]), detail: "d" });
    // @ts-expect-error 正常生成口は検証済みの FindingKind だけを受け取る
    Finding.of({ kind: "no-such-kind", frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["check:DD-0"]), witness: { refs: WitnessRefs.of([]) }, detail: "DD-0: x" });

    // 検証済み kind を渡した正常生成は、その kind をそのまま持つ。
    expect(DesignFinding.of({ kind: FindingKind.conflict(), ...designProps }).kind()).toBe("conflict");
  });
});

describe("未知 kind を含む既存文書は hydration でき、既知 kind より後ろで降格する (BR3.2)", () => {
  test("adapter が未知 kind を逐語で解き、正準順で末尾に置き、降格文言を保つ", () => {
    const dir = mkdtempSync(join(tmpdir(), "refcheck-unknown-kind-"));
    try {
      // 未来のバックエンドが書いたつもりの文書——未知 kind が既知 kind に
      // 混ざっている。adapter の Repository がこれを解く（tolerant hydration）。
      writeFileSync(
        join(dir, "components.json"),
        JSON.stringify({
          backend: "components",
          irVersion: "x",
          irHash: "0".repeat(64),
          method: "static",
          inputs: [],
          checked: [],
          findings: [
            { kind: "no-such-kind", frRefs: [], targets: ["check:DD-9"], witness: { refs: [] }, detail: "DD-9: from the future" },
            { kind: "structure-invalid", frRefs: [], targets: ["check:DD-0"], witness: { refs: [] }, detail: "DD-0: known" },
          ],
          skipped: [],
        }),
      );
      const repository = new ReferenceCheckReportRepositoryImpl();
      const found = repository.findById(ReferenceCheckReportId.of(refcheckPath(dir), "components"));
      expect(found.ok).toBe(true);
      if (!found.ok) throw new Error("unreachable: the written document must hydrate");

      // 逐語保持 + 正準順（未知 kind の順位は 99——既知のどれよりも後ろ）。
      expect(found.value.findings().sortedCanonically().toArray().map((f) => f.kind()))
        .toEqual(["structure-invalid", "no-such-kind"]);

      // 降格：未知 kind の文書は契約適合に落ち、凍結文言の unavailable になる。
      const schemaFile = readContractSchema(findingsSchemaPath);
      const findingsSchema = schemaFile.ok ? FindingsSchema.of(schemaFile.value) : FindingsSchema.unreadable(schemaFile.error.cause);
      const conformed = found.value.conformedTo(findingsSchema);
      expect(conformed.isUnavailable()).toBe(true);
      expect(conformed.unavailableReason()).toStartWith("self-validation against deep-spec-findings-schema.json failed: ");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    // design／requirements 側の hydration も同じ順位規則で末尾へ落とす。
    const designOrder = DesignFindings.of([
      DesignFinding.reconstitute({ kind: "no-such-kind", frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["OB-9"]), witness: DesignWitness.core([]), unit: "u1", detail: "z" }),
      DesignFinding.reconstitute({ kind: "conflict", frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["OB-1"]), witness: DesignWitness.core([]), unit: "u1", detail: "a" }),
    ]).sortedCanonically().toArray().map((f) => f.kind());
    expect(designOrder).toEqual(["conflict", "no-such-kind"]);

    const verificationOrder = VerificationFindings.of([
      VerificationFinding.reconstitute({ kind: "no-such-kind", frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["OB-9"]), witness: VerificationWitness.core([]), detail: "z" }),
      VerificationFinding.reconstitute({ kind: "conflict", frRefs: FrRefs.reconstitute([]), targets: TargetIds.reconstitute(["OB-1"]), witness: VerificationWitness.core([]), detail: "a" }),
    ]).sortedCanonically().toArray().map((f) => f.kind());
    expect(verificationOrder).toEqual(["conflict", "no-such-kind"]);
  });
});


// --- 契約2 のスキーマ値（FindingsSchema）------------------------------------
//
//   - 読めなかったスキーマはすべての文書を降格させる（「検査できなかった」を
//     「適合していた」と取り違えない）
//   - 適合しない文書は凍結文言で降格する
//   - 適合する文書は降格しない（不在＝null）

describe("FindingsSchema は契約2 の適合判定を値として持つ", () => {
  test("読めなかったスキーマは、どの文書にも凍結文言の降格理由を与える", () => {
    const unreadable = FindingsSchema.unreadable("ENOENT: no such file or directory");
    expect(unreadable.degradationReasonFor({ backend: "smt" }))
      .toBe("findings schema unreadable: ENOENT: no such file or directory");
    // 中身に関わらず降格する——空の文書でも同じ理由。
    expect(unreadable.degradationReasonFor({})).toBe("findings schema unreadable: ENOENT: no such file or directory");
  });

  test("適合しない文書は凍結文言で降格し、適合する文書は降格しない", () => {
    const file = readContractSchema(findingsSchemaPath);
    expect(file.ok).toBe(true);
    if (!file.ok) throw new Error("unreachable: the shipped contract schema must be readable");
    const schema = FindingsSchema.of(file.value);

    // 未知 kind の finding を持つ文書は自己検証に落ちる。
    const violating = designReportOf([
      DesignFinding.reconstitute({
        kind: "no-such-kind",
        frRefs: FrRefs.reconstitute([]),
        targets: TargetIds.reconstitute(["OB-1"]),
        witness: DesignWitness.core([]),
        unit: "u1",
        detail: "from the future",
      }),
    ]);
    expect(schema.degradationReasonFor(violating.toDocument()))
      .toStartWith("self-validation against deep-spec-findings-schema.json failed: ");

    // 適合する文書は降格しない（不在で表す）。
    expect(schema.degradationReasonFor(designReportOf([]).toDocument())).toBe(null);
    // 集約の conformedTo も同じ判定に従う。
    expect(designReportOf([]).conformedTo(schema).isUnavailable()).toBe(false);
    expect(violating.conformedTo(schema).unavailableReason())
      .toStartWith("self-validation against deep-spec-findings-schema.json failed: ");
  });
});

describe("ReferenceCheckReport.conformedTo は契約2 の適合判定を集約自身の言葉で運ぶ", () => {
  test("適合する文書は自分自身を返し、適合しない文書は凍結文言で降格する", () => {
    const file = readContractSchema(findingsSchemaPath);
    expect(file.ok).toBe(true);
    if (!file.ok) throw new Error("unreachable: the shipped contract schema must be readable");
    const schema = FindingsSchema.of(file.value);

    const clean = ReferenceCheckReport.reconstitute({
      id: ReferenceCheckReportId.of(refcheckPath("/tmp/r"), "components"),
      inputs: InputAnchors.of([]),
      checked: TargetIds.reconstitute(["check:DD-0"]),
      findings: Findings.of([]),
      skipped: Skips.of([]),
      unavailableReason: null,
    });
    expect(clean.conformedTo(schema)).toBe(clean);

    // 未知 kind は書かれた文書だけが運ぶ形（Finding.reconstitute）で組む——
    // 正常生成口は検証済みの FindingKind しか受け取らない（BR3.1）。
    const violating = ReferenceCheckReport.reconstitute({
      id: ReferenceCheckReportId.of(refcheckPath("/tmp/r"), "components"),
      inputs: InputAnchors.of([]),
      checked: TargetIds.reconstitute([]),
      findings: Findings.of([
        Finding.reconstitute({
          kind: "no-such-kind",
          frRefs: FrRefs.reconstitute([]),
          targets: TargetIds.reconstitute(["check:DD-0"]),
          witness: { refs: WitnessRefs.of([]) },
          detail: "DD-0: from the future",
        }),
      ]),
      skipped: Skips.of([]),
      unavailableReason: null,
    });
    expect(violating.conformedTo(schema).unavailableReason())
      .toStartWith("self-validation against deep-spec-findings-schema.json failed: ");
  });
});

// --- 設計検証ディレクトリの集約（DesignVerifyDirectory）---------------------
//
//   - backend ごとに report は 1 つ（finalizing は置換し、ファイル名順を保つ）
//   - cross-check は不在か、いまの reports から導いたもの（候補を置いたら落ちる）

describe("DesignVerifyDirectory は backend ごとに 1 report という不変条件を守る", () => {
  test("finalizing は同じ backend を置換し、新しい backend はファイル名順に挿す", () => {
    const directory = designPath("/records/deep-spec-design-verify");
    const loaded = DesignVerifyDirectory.of(
      directory,
      DesignReports.of([reportOf(directory, "quint"), reportOf(directory, "smt")]),
      null,
    );

    // 既存 backend は置換される——件数は増えない。
    const replaced = loaded.finalizing(reportOf(directory, "smt", "simulation"));
    expect(replaced.reports().toArray().map((r) => r.id().fileName())).toEqual(["quint.json", "smt.json"]);
    expect(replaced.reports().toArray().map((r) => r.method())).toEqual(["exhaustive", "simulation"]);
    expect(replaced.candidate()?.id().fileName()).toBe("smt.json");

    // 新しい backend はファイル名順の位置へ挿す（読み出しの全順序を崩さない）。
    const inserted = loaded.finalizing(reportOf(directory, "apalache"));
    expect(inserted.reports().toArray().map((r) => r.id().fileName())).toEqual(["apalache.json", "quint.json", "smt.json"]);
    const appended = loaded.finalizing(reportOf(directory, "z3"));
    expect(appended.reports().toArray().map((r) => r.id().fileName())).toEqual(["quint.json", "smt.json", "z3.json"]);
  });

  test("候補を置くと古い cross-check は落ち、withoutCrossCheck も不在のまま", () => {
    const directory = designPath("/records/deep-spec-design-verify");
    const loaded = DesignVerifyDirectory.of(
      directory,
      DesignReports.of([reportOf(directory, "smt")]),
      reportOf(directory, "cross-check"),
    );
    expect(loaded.crossCheck()?.id().fileName()).toBe("cross-check.json");
    // 候補が変われば「いまの reports から導いたもの」でなくなる——落とす。
    const staged = loaded.finalizing(reportOf(directory, "smt", "simulation"));
    expect(staged.crossCheck()).toBe(null);
    expect(staged.withoutCrossCheck().crossCheck()).toBe(null);
    // load 直後は候補を持たない。
    expect(loaded.candidate()).toBe(null);
    expect(loaded.directory().asString()).toBe("/records/deep-spec-design-verify");
  });
});

// --- 要件検証ディレクトリの集約（VerificationDirectory）---------------------
//
// 設計側（DesignVerifyDirectory）と同じ 2 つの不変条件を要件の語彙で固定する:
//   - backend ごとに report は 1 つ（finalizing は置換し、ファイル名順を保つ）
//   - cross-check は不在か、いまの reports から導いたもの（候補を置いたら落ちる）

// テスト用: 要件 report の短縮構築（識別と method 以外は空）。
function verificationReportOf(directory: ArtifactPath, backend: string, method = "exhaustive"): VerificationReport {
  return VerificationReport.compose({
    id: VerificationReportId.of(directory, backend),
    irVersion: IrVersion.reconstitute("1.0.0"),
    irHash: ContentHash.ofText("ir"),
    method,
    findings: VerificationFindings.of([]),
    skipped: VerificationSkips.of([]),
  });
}

describe("VerificationDirectory は backend ごとに 1 report という不変条件を守る", () => {
  test("finalizing は同じ backend を置換し、新しい backend はファイル名順に挿す", () => {
    const directory = designPath("/records/deep-spec-verify");
    const loaded = VerificationDirectory.of(
      directory,
      VerificationReports.of([verificationReportOf(directory, "quint"), verificationReportOf(directory, "smt")]),
      null,
    );

    // 既存 backend は置換される——件数は増えない。
    const replaced = loaded.finalizing(verificationReportOf(directory, "smt", "simulation"));
    expect(replaced.reports().toArray().map((r) => r.id().fileName())).toEqual(["quint.json", "smt.json"]);
    expect(replaced.reports().toArray().map((r) => r.method())).toEqual(["exhaustive", "simulation"]);
    expect(replaced.candidate()?.id().fileName()).toBe("smt.json");

    // 新しい backend はファイル名順の位置へ挿す（読み出しの全順序を崩さない）。
    const inserted = loaded.finalizing(verificationReportOf(directory, "apalache"));
    expect(inserted.reports().toArray().map((r) => r.id().fileName())).toEqual(["apalache.json", "quint.json", "smt.json"]);
    const appended = loaded.finalizing(verificationReportOf(directory, "z3"));
    expect(appended.reports().toArray().map((r) => r.id().fileName())).toEqual(["quint.json", "smt.json", "z3.json"]);
  });

  test("候補を置くと古い cross-check は落ち、conformedTo は候補と cross-check の両方に効く", () => {
    const directory = designPath("/records/deep-spec-verify");
    const loaded = VerificationDirectory.of(
      directory,
      VerificationReports.of([verificationReportOf(directory, "smt")]),
      verificationReportOf(directory, "cross-check"),
    );
    expect(loaded.crossCheck()?.id().fileName()).toBe("cross-check.json");
    // 候補が変われば「いまの reports から導いたもの」でなくなる——落とす。
    const staged = loaded.finalizing(verificationReportOf(directory, "smt", "simulation"));
    expect(staged.crossCheck()).toBe(null);
    expect(staged.withoutCrossCheck().crossCheck()).toBe(null);
    // load 直後は候補を持たない。
    expect(loaded.candidate()).toBe(null);
    expect(loaded.directory().asString()).toBe("/records/deep-spec-verify");

    // 読めなかったスキーマは、候補も公開済み cross-check も同じ文言で降格させる
    // ——「検査できなかった」を「適合していた」と取り違えない。
    const unreadable = FindingsSchema.unreadable("ENOENT: no such file or directory");
    const reason = "findings schema unreadable: ENOENT: no such file or directory";
    const conformedCandidate = staged.conformedTo(unreadable);
    expect(conformedCandidate.candidate()?.unavailableReason()).toBe(reason);
    // 適合済みの候補は reports 側にも反映される（公開する 1 つの観測）。
    expect(conformedCandidate.reports().toArray().map((r) => r.isUnavailable())).toEqual([true]);
    expect(loaded.conformedTo(unreadable).crossCheck()?.unavailableReason()).toBe(reason);
  });
});
