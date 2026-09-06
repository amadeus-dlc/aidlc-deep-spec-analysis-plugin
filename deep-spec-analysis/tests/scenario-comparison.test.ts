import { expect, test } from "bun:test";
import {
  BackendName,
  ScenarioComparison,
  ScenarioVerdict,
  ScenarioVerdicts,
  TargetIdentifier,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

const target = TargetIdentifier.of("SC-1");
const backend = BackendName.of;
const clean = ScenarioVerdict.clean(backend("smt"), target, null);
const violation = ScenarioVerdict.violated(backend("quint"), target, null);

test("比較は判定済みの異なるバックエンドの組だけを列挙する", () => {
  const values = [
    clean,
    violation,
    ScenarioVerdict.clean(backend("third"), target, null),
    ScenarioVerdict.skipped(backend("skip"), target, null),
    ScenarioVerdict.unavailable(backend("down"), target, null),
  ];
  const verdicts = ScenarioVerdicts.of(values);
  values.splice(0);
  expect([...verdicts.comparisons()].map((comparison) => comparison.disagrees())).toEqual([true, false, true]);
  expect([...ScenarioVerdicts.of([clean]).comparisons()]).toEqual([]);
  expect([...ScenarioVerdicts.of([]).comparisons()]).toEqual([]);
  expect(ScenarioComparison.of(clean, violation).toVerdictTable()).toEqual({ smt: "clean", quint: "violated" });
});

test("比較の対象・所属・バックエンドの契約はofとparseの両方が保証する", () => {
  for (const other of [
    ScenarioVerdict.clean(backend("smt"), target, null),
    ScenarioVerdict.clean(backend("quint"), TargetIdentifier.of("SC-2"), null),
    ScenarioVerdict.clean(backend("quint"), target, UnitName.of("u1")),
    ScenarioVerdict.skipped(backend("quint"), target, null),
    ScenarioVerdict.unavailable(backend("quint"), target, null),
  ]) {
    expect(() => ScenarioComparison.of(clean, other)).toThrow(IllegalArgumentException);
    const parsed = ScenarioComparison.parse(clean, other);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
  expect(ScenarioComparison.parse(clean, violation).ok).toBe(true);
  const scoped = ScenarioVerdict.clean(backend("smt"), target, UnitName.of("u1"));
  expect(scoped.sameSubjectAs(ScenarioVerdict.violated(backend("quint"), target, UnitName.of("u1")))).toBe(true);
  expect(scoped.sameSubjectAs(clean)).toBe(false);
  expect(scoped.sameSubjectAs(ScenarioVerdict.clean(backend("quint"), target, UnitName.of("u2")))).toBe(false);
});

test("判定集合のサイズ・対象・一意性を構築時に検証する", () => {
  const wrongTarget = ScenarioVerdict.clean(backend("other"), TargetIdentifier.of("SC-2"), null);
  for (const input of [[clean, clean], [clean, wrongTarget], Array.from({ length: 129 }, () => clean)]) {
    expect(() => ScenarioVerdicts.of(input)).toThrow(IllegalArgumentException);
    const parsed = ScenarioVerdicts.parse(input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
  const boundary = Array.from({ length: 128 }, (_, index) => ScenarioVerdict.clean(backend(`b${index}`), target, null));
  const parsed = ScenarioVerdicts.parse(boundary);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect([...parsed.value.comparisons()].length).toBe(8128);
});

test("判定集合は一度取得した入力に対して所属の検証と比較を行う", () => {
  const input = [clean, violation];
  const other = ScenarioVerdict.clean(backend("smt"), TargetIdentifier.of("SC-2"), null);
  let firstRead = true;
  Object.defineProperty(input, 0, {
    get: () => {
      const value = firstRead ? clean : other;
      firstRead = false;
      return value;
    },
  });
  const parsed = ScenarioVerdicts.parse(input);
  expect(parsed.ok).toBe(true);
  if (parsed.ok)
    expect([...parsed.value.comparisons()].map((comparison) => comparison.toVerdictTable())).toEqual([
      { smt: "clean", quint: "violated" },
    ]);
});

test("読み取り途中に増大する比較入力もサイズ予算で拒否する", () => {
  const input = [clean];
  Object.defineProperty(input, 0, {
    get: () => {
      input.length = 129;
      input.fill(clean, 1);
      return clean;
    },
  });
  expect(ScenarioVerdicts.parse(input)).toEqual({ ok: false, error: { kind: "too-many-scenario-verdicts", raw: 129 } });
});

test("未検査にcleanの表示を与えず、特殊なバックエンド名も判定表に残す", () => {
  expect(() => ScenarioVerdict.skipped(backend("skip"), target, null).verdictLabel()).toThrow();
  const comparison = ScenarioComparison.of(ScenarioVerdict.violated(backend("__proto__"), target, null), clean);
  expect(Object.hasOwn(comparison.toVerdictTable(), "__proto__")).toBe(true);
  expect(Object.getOwnPropertyDescriptor(comparison.toVerdictTable(), "__proto__")?.value).toBe("violated");
});
