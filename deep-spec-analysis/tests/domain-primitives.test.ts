import {
  UnitName,
  ArtifactPath,
  FindingKind,
  FindingsSchema,
  FrRefs,
  IrVersion,
  ContentHash,
  SkipReason,
  TargetId,
  TargetIds,
  VerificationMethod,
} from "@deep-spec/kernel-domain";

// of は契約違反を送出し、parse は同じ違反を Result に変換する。

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
    irVersion: IrVersion.of("1.0.0"),
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
    irVersion: IrVersion.of("1.0.0"),
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
      if (ok.ok) expect(ok.value.asString()).toBe(reason);
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
    expect(factories.map((r) => r.asString())).toEqual(KNOWN_SKIP_REASONS);
    for (const reason of factories) expect(SkipReason.parse(reason.asString()).ok).toBe(true);
  });
});

describe("construction rejects invalid vocabulary from every source", () => {
  test("VerificationMethod of rejects unknown values and retains the diagnostic input", () => {
    const result = VerificationMethod.parse("no-such-method");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.raw).toBe("no-such-method");
  });

  test("SkipReason of rejects unknown values and retains the diagnostic input", () => {
    const result = SkipReason.parse("no-such-reason");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.raw).toBe("no-such-reason");
  });

  test("a skip cannot acquire an invalid reason through a hydration bypass", () => {
    const result = SkipReason.parse("no-such-reason");
    expect(result.ok).toBe(false);
    expect("reconstitute" in SkipReason).toBe(false);
    expect("reconstitute" in DesignSkipped).toBe(false);
  });
});

// finding kind の生成契約。正常生成と文書の復元に同じ規則を適用する。
//
//   - BR3.1: 正常生成口（`DesignFinding.of` / `VerificationFinding.of` /
//     refcheck `Finding.of`）は検証済みの `FindingKind` しか受け取らない——
//     未知 kind は型で弾かれ、閉集合の門 `FindingKind.parse` は Result の
//     error になる
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
    const designProps = { frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["OB-1"], (raw) => TargetId.of(raw))), witness: DesignWitness.core([]), unit: UnitName.of("u1"), detail: "d" };
    // @ts-expect-error 正常生成口は検証済みの FindingKind だけを受け取る
    DesignFinding.of({ kind: "no-such-kind", ...designProps });
    // @ts-expect-error 正常生成口は検証済みの FindingKind だけを受け取る
    VerificationFinding.of({ kind: "no-such-kind", frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["OB-1"], (raw) => TargetId.of(raw))), witness: VerificationWitness.core([]), detail: "d" });
    // @ts-expect-error 正常生成口は検証済みの FindingKind だけを受け取る
    Finding.of({ kind: "no-such-kind", frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["check:DD-0"], (raw) => TargetId.of(raw))), witness: { refs: WitnessRefs.of([]) }, detail: "DD-0: x" });

    // 検証済み kind を渡した正常生成は、その kind をそのまま持つ。
    expect(DesignFinding.of({ kind: FindingKind.conflict(), ...designProps }).kind()).toBe("conflict");
  });
});

describe("未知 kind は既存文書からも生成できず、診断に原文を残す", () => {
  test("adapter が未知 kind を取得失敗として返し、原文を診断に保つ", () => {
    const dir = mkdtempSync(join(tmpdir(), "refcheck-unknown-kind-"));
    try {
      // 未来のバックエンドが書いたつもりの文書——未知 kind が既知 kind に
      // 混ざっている。adapter の Repository がこれを解く。
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
      expect(found.ok).toBe(false);
      if (!found.ok) {
        expect(found.error.kind).toBe("corrupt");
        expect("cause" in found.error && found.error.cause).toContain("no-such-kind");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    expect(FindingKind.parse("no-such-kind").ok).toBe(false);
    expect("reconstitute" in VerificationFinding).toBe(false);
    expect("reconstitute" in DesignFinding).toBe(false);
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
    const schema = FindingsSchema.of({ type: "object", properties: { findings: { type: "array", maxItems: 0 } } });

    // findings を許可しないスキーマで集約の適合処理を確認する。
    const violating = designReportOf([
      DesignFinding.of({
        kind: FindingKind.conflict(),
        frRefs: FrRefs.of([]),
        targets: TargetIds.of(Array.from(["OB-1"], (raw) => TargetId.of(raw))),
        witness: DesignWitness.core([]),
        unit: UnitName.of("u1"),
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
    const schema = FindingsSchema.of({ type: "object", properties: { findings: { type: "array", maxItems: 0 } } });

    const clean = ReferenceCheckReport.of({
      id: ReferenceCheckReportId.of(refcheckPath("/tmp/r"), "components"),
      inputs: InputAnchors.of([]),
      checked: TargetIds.of(Array.from(["check:DD-0"], (raw) => TargetId.of(raw))),
      findings: Findings.of([]),
      skipped: Skips.of([]),
      unavailableReason: null,
    });
    expect(clean.conformedTo(schema)).toBe(clean);

    const violating = ReferenceCheckReport.of({
      id: ReferenceCheckReportId.of(refcheckPath("/tmp/r"), "components"),
      inputs: InputAnchors.of([]),
      checked: TargetIds.of([]),
      findings: Findings.of([
        Finding.of({
          kind: FindingKind.conflict(),
          frRefs: FrRefs.of([]),
          targets: TargetIds.of(Array.from(["check:DD-0"], (raw) => TargetId.of(raw))),
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
    irVersion: IrVersion.of("1.0.0"),
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
