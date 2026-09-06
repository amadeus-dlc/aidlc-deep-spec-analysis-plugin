import { expect, test } from "bun:test";
import {
  DesignCrossCheckedEntry,
  IssuedLoweredIdentifiers,
  LoweredIdentifier,
} from "@deep-spec-analysis/design-domain";
import { BackendName, TargetIdentifier, TargetIdentifiers, UnitName } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import { CrossCheckedEntry } from "@deep-spec-analysis/requirements-domain";

test("発行台帳は重複と上限超過をofとparseの両方で拒否する", () => {
  const id = LoweredIdentifier.of("OB-2");
  for (const values of [[id, id], Array.from({ length: 65_537 }, () => id)]) {
    expect(() => IssuedLoweredIdentifiers.of(values)).toThrow(IllegalArgumentException);
    const parsed = IssuedLoweredIdentifiers.parse(values);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
  const parsed = IssuedLoweredIdentifiers.parse([id]);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.value.availableObligations().next().value?.asString()).toBe("OB-1");
});

test.each(["OB", "SC", "BG"])("%sで総件数上限に達した台帳は追加義務IDを発行しない", (namespace) => {
  const issued = IssuedLoweredIdentifiers.of(
    Array.from({ length: 65_536 }, (_, index) => LoweredIdentifier.of(`${namespace}-${index + 1}`)),
  );
  expect(issued.availableObligations().next().done).toBe(true);
});

test("複数の名前空間で共有する残予算だけを発行し、既存義務IDを避ける", () => {
  const issued = IssuedLoweredIdentifiers.of([
    LoweredIdentifier.of("OB-1"),
    LoweredIdentifier.of("BG-1"),
    ...Array.from({ length: 65_532 }, (_, index) => LoweredIdentifier.of(`SC-${index + 1}`)),
  ]);
  const available = issued.availableObligations();
  expect(available.next().value?.asString()).toBe("OB-2");
  expect(available.next().value?.asString()).toBe("OB-3");
  expect(available.next().done).toBe(true);
});

test("lowered IDは発行する名前空間と整数形式だけを受け付ける", () => {
  for (const raw of ["OB-1", "SC-1", "BG-1"]) expect(LoweredIdentifier.parse(raw).ok).toBe(true);
  for (const raw of ["OB-1\n", "SC-", "DOB-1", "OB-x"]) {
    expect(() => LoweredIdentifier.of(raw)).toThrow(IllegalArgumentException);
    expect(LoweredIdentifier.parse(raw).ok).toBe(false);
  }
});

test("比較済みエントリの対象はコンテキストのシナリオIDでなければならない", () => {
  const backend = BackendName.of("smt");
  const unit = UnitName.of("u1");
  const requirements = { backend, targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]) };
  const design = { backend, unit, targets: TargetIdentifiers.of([TargetIdentifier.of("DSC-1")]) };
  expect(CrossCheckedEntry.parse(requirements).ok).toBe(true);
  expect(DesignCrossCheckedEntry.parse(design).ok).toBe(true);
  expect(() => CrossCheckedEntry.of({ ...requirements, targets: design.targets })).toThrow(IllegalArgumentException);
  expect(CrossCheckedEntry.parse({ ...requirements, targets: design.targets }).ok).toBe(false);
  expect(() => DesignCrossCheckedEntry.of({ ...design, targets: requirements.targets })).toThrow(
    IllegalArgumentException,
  );
  const rejected = DesignCrossCheckedEntry.parse({ ...design, targets: requirements.targets });
  expect(rejected.ok).toBe(false);
  if (!rejected.ok) expect(rejected.error).not.toBeInstanceOf(Error);
});

test("発行台帳の入力が読取中に増えてもサイズ検査を迂回しない", () => {
  const id = LoweredIdentifier.of("OB-1");
  const values = [id];
  Object.defineProperty(values, 0, {
    get: () => {
      values.length = 65_537;
      values.fill(id, 1);
      return id;
    },
  });
  expect(IssuedLoweredIdentifiers.parse(values)).toEqual({
    ok: false,
    error: { kind: "too-many-lowered-identifiers", raw: 65_537 },
  });
});
