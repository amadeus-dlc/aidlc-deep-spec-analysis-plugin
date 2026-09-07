// src/doctor/domain の equals/hashCode 契約テスト。hashCode() が等価な値どうしで
// 一致すること（逆は要求しない——衝突は許される）、同じ値からは決定的に同じ値を
// 返すこと、そして equals() が宣言された全フィールドを見ていることを、フィールドを
// 1 つずつ変えた相手との比較で表明する。ファーストクラスコレクション
// （InstalledStatuses・ManifestEntries）は同時に契約操作（map/combine/filter/parse）を
// 表明する。

import { describe, expect, test } from "bun:test";
import {
  Check,
  CheckSeverity,
  CoverageState,
  DesignArtifactReference,
  FindingCount,
  InstalledStatus,
  InstalledStatuses,
  IntentLocation,
  ManifestEntries,
  ManifestEntry,
  PluginVersion,
  StageScope,
  StructuralObservation,
  VerificationEvidence,
} from "@deep-spec-analysis/doctor-domain";
import { ArtifactPath, ContentHash, ErrorMessage, SkipReason, UnitName } from "@deep-spec-analysis/kernel-domain";
import { requireSuccess } from "./result-fixtures.ts";

describe("CheckSeverity", () => {
  test("同じ深刻度は等価かつ同じハッシュ、異なる深刻度は非等価", () => {
    const errorA = CheckSeverity.error();
    const errorB = CheckSeverity.error();
    const advisory = CheckSeverity.advisory();

    expect(errorA.equals(errorB)).toBe(true);
    expect(errorA.equals(advisory)).toBe(false);
    expect(errorA.hashCode()).toBe(errorB.hashCode());
    expect(errorA.hashCode()).toBe(errorA.hashCode());
  });
});

describe("CoverageState", () => {
  test("同じ状態は等価かつ同じハッシュ、異なる状態は非等価", () => {
    const unverifiedA = CoverageState.unverified();
    const unverifiedB = CoverageState.unverified();
    const stale = CoverageState.stale();

    expect(unverifiedA.equals(unverifiedB)).toBe(true);
    expect(unverifiedA.equals(stale)).toBe(false);
    expect(unverifiedA.hashCode()).toBe(unverifiedB.hashCode());
    expect(unverifiedA.hashCode()).toBe(unverifiedA.hashCode());
  });
});

describe("Check", () => {
  const base = () =>
    Check.of({ pass: true, label: "manifest entry present", fix: "run install", severity: CheckSeverity.error() });

  test("等価は pass・label・fix・severity の全フィールドを見る", () => {
    const a = base();
    const same = base();
    const diffPass = Check.of({
      pass: false,
      label: "manifest entry present",
      fix: "run install",
      severity: CheckSeverity.error(),
    });
    const diffLabel = Check.of({
      pass: true,
      label: "other check",
      fix: "run install",
      severity: CheckSeverity.error(),
    });
    const diffFix = Check.of({
      pass: true,
      label: "manifest entry present",
      fix: "run something else",
      severity: CheckSeverity.error(),
    });
    const noFix = Check.of({ pass: true, label: "manifest entry present", severity: CheckSeverity.error() });
    const diffSeverity = Check.of({
      pass: true,
      label: "manifest entry present",
      fix: "run install",
      severity: CheckSeverity.advisory(),
    });

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffPass)).toBe(false);
    expect(a.equals(diffLabel)).toBe(false);
    expect(a.equals(diffFix)).toBe(false);
    expect(a.equals(noFix)).toBe(false);
    expect(a.equals(diffSeverity)).toBe(false);
  });

  test("ハッシュは等しい値どうしで一致し、決定的", () => {
    const a = base();
    const same = base();

    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("DesignArtifactReference", () => {
  const location = (space: string, intent: string) =>
    IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent));
  const reference = (props: {
    space?: string;
    intent?: string;
    tool?: string;
    artifactPath?: string;
    relativePath?: string;
  }) =>
    DesignArtifactReference.of({
      location: location(props.space ?? "default", props.intent ?? "i1"),
      tool: ArtifactPath.of(props.tool ?? "refcheck.ts"),
      artifactPath: ArtifactPath.of(props.artifactPath ?? "/project/src/a.ts"),
      relativePath: ArtifactPath.of(props.relativePath ?? "src/a.ts"),
    });

  test("等価は space・intent・tool・artifactPath・relativePath の全フィールドを見る", () => {
    const a = reference({});
    const same = reference({});
    const diffSpace = reference({ space: "other-space" });
    const diffIntent = reference({ intent: "i2" });
    const diffTool = reference({ tool: "design.ts" });
    const diffArtifactPath = reference({ artifactPath: "/project/src/b.ts" });
    const diffRelativePath = reference({ relativePath: "src/b.ts" });

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffSpace)).toBe(false);
    expect(a.equals(diffIntent)).toBe(false);
    expect(a.equals(diffTool)).toBe(false);
    expect(a.equals(diffArtifactPath)).toBe(false);
    expect(a.equals(diffRelativePath)).toBe(false);
  });

  test("ハッシュは等しい値どうしで一致し、決定的", () => {
    const a = reference({});
    const same = reference({});

    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("ManifestEntry", () => {
  test("等価は rel を見る", () => {
    const a = ManifestEntry.error(ArtifactPath.of("hooks/aidlc-foo.ts"));
    const same = ManifestEntry.error(ArtifactPath.of("hooks/aidlc-foo.ts"));
    const diffRel = ManifestEntry.error(ArtifactPath.of("hooks/aidlc-bar.ts"));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffRel)).toBe(false);
  });

  test("ハッシュは等しい値どうしで一致し、決定的", () => {
    const a = ManifestEntry.error(ArtifactPath.of("hooks/aidlc-foo.ts"));
    const same = ManifestEntry.error(ArtifactPath.of("hooks/aidlc-foo.ts"));

    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });

  test("filter は rebuild 経由で述語を満たすエントリだけの ManifestEntries を返す", () => {
    const entries = ManifestEntries.of([
      ManifestEntry.error(ArtifactPath.of("hooks/aidlc-foo.ts")),
      ManifestEntry.error(ArtifactPath.of("hooks/aidlc-bar.ts")),
    ]);

    const onlyFoo = entries.filter((entry) => entry.rel().includes("foo"));

    expect(onlyFoo).toBeInstanceOf(ManifestEntries);
    expect([...onlyFoo].map((entry) => entry.rel())).toEqual(["hooks/aidlc-foo.ts"]);
  });
});

describe("InstalledStatus", () => {
  const entryFor = (rel: string) => ManifestEntry.error(ArtifactPath.of(rel));

  test("等価は entry・present の両方を見る", () => {
    const a = InstalledStatus.of(entryFor("hooks/aidlc-foo.ts"), true);
    const same = InstalledStatus.of(entryFor("hooks/aidlc-foo.ts"), true);
    const diffEntry = InstalledStatus.of(entryFor("hooks/aidlc-bar.ts"), true);
    const diffPresent = InstalledStatus.of(entryFor("hooks/aidlc-foo.ts"), false);

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffEntry)).toBe(false);
    expect(a.equals(diffPresent)).toBe(false);
  });

  test("ハッシュは等しい値どうしで一致し、決定的", () => {
    const a = InstalledStatus.of(entryFor("hooks/aidlc-foo.ts"), true);
    const same = InstalledStatus.of(entryFor("hooks/aidlc-foo.ts"), true);

    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("InstalledStatuses", () => {
  const entryFor = (rel: string) => ManifestEntry.error(ArtifactPath.of(rel));
  const status = (rel: string, present: boolean) => InstalledStatus.of(entryFor(rel), present);

  test("empty から add で積んだ列が count・toArray に反映される", () => {
    const built = InstalledStatuses.empty().add(status("a.ts", true)).add(status("b.ts", false));

    expect(built.count()).toBe(2);
    expect(built.toArray().map((s) => s.isPresent())).toEqual([true, false]);
  });

  test("map は要素ごとに変換した InstalledStatuses を返す", () => {
    const built = InstalledStatuses.of([status("a.ts", true), status("b.ts", false)]);

    const flipped = built.map((s) => InstalledStatus.of(s.entry(), !s.isPresent()));

    expect(flipped).toBeInstanceOf(InstalledStatuses);
    expect(flipped.toArray().map((s) => s.isPresent())).toEqual([false, true]);
  });

  test("combine は 2 つの列を連結した InstalledStatuses を返す", () => {
    const left = InstalledStatuses.of([status("a.ts", true)]);
    const right = InstalledStatuses.of([status("b.ts", false)]);

    const combined = left.combine(right);

    expect(combined).toBeInstanceOf(InstalledStatuses);
    expect(combined.toArray().map((s) => s.entry().rel())).toEqual(["a.ts", "b.ts"]);
  });

  test("filter は rebuild 経由で述語を満たす行だけの InstalledStatuses を返す", () => {
    const built = InstalledStatuses.of([status("a.ts", true), status("b.ts", false), status("c.ts", true)]);

    const onlyPresent = built.filter((s) => s.isPresent());

    expect(onlyPresent).toBeInstanceOf(InstalledStatuses);
    expect(onlyPresent.toArray().map((s) => s.entry().rel())).toEqual(["a.ts", "c.ts"]);
  });

  test("parse は正常な列から InstalledStatuses を構築する", () => {
    const parsed = requireSuccess(InstalledStatuses.parse([status("a.ts", true)]));

    expect(parsed.count()).toBe(1);
  });

  test("equals・hashCode は要素列全体の一致を見る", () => {
    const a = InstalledStatuses.of([status("a.ts", true), status("b.ts", false)]);
    const same = InstalledStatuses.of([status("a.ts", true), status("b.ts", false)]);
    const different = InstalledStatuses.of([status("a.ts", true)]);

    expect(a.equals(same)).toBe(true);
    expect(a.equals(different)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("PluginVersion", () => {
  test("等価は major・minor・patch の全フィールドを見る", () => {
    const a = PluginVersion.of("1.2.3");
    const same = PluginVersion.of("1.2.3");
    const diffMajor = PluginVersion.of("2.2.3");
    const diffMinor = PluginVersion.of("1.3.3");
    const diffPatch = PluginVersion.of("1.2.4");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffMajor)).toBe(false);
    expect(a.equals(diffMinor)).toBe(false);
    expect(a.equals(diffPatch)).toBe(false);
  });

  test("ハッシュは等しい値どうしで一致し、決定的", () => {
    const a = PluginVersion.of("1.2.3");
    const same = PluginVersion.of("1.2.3");

    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("StageScope", () => {
  test("同じ値は等価かつ同じハッシュ、異なる値は非等価", () => {
    const a = StageScope.of("domain-design");
    const same = StageScope.of("domain-design");
    const other = StageScope.of("code-generation");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("StructuralObservation", () => {
  const location = IntentLocation.of(ArtifactPath.of("default"), ArtifactPath.of("i1"));
  const artifact = (relative: string) =>
    DesignArtifactReference.of({
      location,
      tool: ArtifactPath.of("refcheck.ts"),
      artifactPath: ArtifactPath.of(`/project/${relative}`),
      relativePath: ArtifactPath.of(relative),
    });

  test("3種の判別共用体は種別が違えば非等価", () => {
    const complete = StructuralObservation.of(artifact("a.ts"), FindingCount.of(1));
    const partial = StructuralObservation.partial(artifact("a.ts"), FindingCount.of(1), ErrorMessage.of("timed out"));
    const unavailable = StructuralObservation.unavailable(artifact("a.ts"), ErrorMessage.of("timed out"));

    expect(complete.equals(partial)).toBe(false);
    expect(complete.equals(unavailable)).toBe(false);
    expect(partial.equals(unavailable)).toBe(false);
  });

  test("complete のハッシュは artifact・findings が揃えば一致し、findings が違えば非等価", () => {
    const a = StructuralObservation.of(artifact("a.ts"), FindingCount.of(1));
    const same = StructuralObservation.of(artifact("a.ts"), FindingCount.of(1));
    const diffFindings = StructuralObservation.of(artifact("a.ts"), FindingCount.of(2));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffFindings)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });

  test("partial のハッシュは artifact・findings・reason が揃えば一致し、reason が違えば非等価", () => {
    const a = StructuralObservation.partial(artifact("a.ts"), FindingCount.of(1), ErrorMessage.of("timed out"));
    const same = StructuralObservation.partial(artifact("a.ts"), FindingCount.of(1), ErrorMessage.of("timed out"));
    const diffReason = StructuralObservation.partial(artifact("a.ts"), FindingCount.of(1), ErrorMessage.of("解析失敗"));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffReason)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });

  test("unavailable のハッシュは artifact・reason が揃えば一致し、reason が違えば非等価", () => {
    const a = StructuralObservation.unavailable(artifact("a.ts"), ErrorMessage.of("timed out"));
    const same = StructuralObservation.unavailable(artifact("a.ts"), ErrorMessage.of("timed out"));
    const diffReason = StructuralObservation.unavailable(artifact("a.ts"), ErrorMessage.of("解析失敗"));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffReason)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("VerificationEvidence", () => {
  const irHash = ContentHash.ofText("ir-content");
  const otherHash = ContentHash.ofText("other-ir-content");

  const evidence = (
    props: { unavailable?: ErrorMessage | null; skippedReasons?: SkipReason[]; checkedUnits?: UnitName[] } = {},
  ) =>
    VerificationEvidence.of({
      irHash,
      unavailable: props.unavailable ?? null,
      skippedReasons: props.skippedReasons ?? [],
      checkedUnits: props.checkedUnits ?? [UnitName.of("unit-a")],
    });

  test("等価は irHash・unavailable・skippedReasons・checkedUnits の全フィールドを見る", () => {
    const a = evidence();
    const same = evidence();
    const diffHash = VerificationEvidence.of({
      irHash: otherHash,
      unavailable: null,
      skippedReasons: [],
      checkedUnits: [UnitName.of("unit-a")],
    });
    const diffUnavailable = evidence({ unavailable: ErrorMessage.of("解析失敗") });
    const diffSkipped = evidence({ skippedReasons: [SkipReason.timeout()] });
    const diffUnits = evidence({ checkedUnits: [UnitName.of("unit-b")] });

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffHash)).toBe(false);
    expect(a.equals(diffUnavailable)).toBe(false);
    expect(a.equals(diffSkipped)).toBe(false);
    expect(a.equals(diffUnits)).toBe(false);
  });

  test("ハッシュは等しい値どうしで一致し、決定的", () => {
    const a = evidence({
      skippedReasons: [SkipReason.timeout()],
      checkedUnits: [UnitName.of("unit-a"), UnitName.of("unit-b")],
    });
    const same = evidence({
      skippedReasons: [SkipReason.timeout()],
      checkedUnits: [UnitName.of("unit-a"), UnitName.of("unit-b")],
    });

    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});
