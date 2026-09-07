import { expect, test } from "bun:test";
import { InstallationManifest, ManifestEntries, ManifestEntry } from "@deep-spec-analysis/doctor-domain";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import { requireSuccess } from "./result-fixtures.ts";

const entry = (path: string) => ManifestEntry.error(ArtifactPath.of(path));

test("manifest entry mapping preserves its concrete collection, order, and source snapshot", () => {
  const source = [entry("a.ts"), entry("b.ts")];
  const entries = ManifestEntries.of(source);
  source.length = 0;
  const mapped = entries.map((value) => entry(`mapped/${value.rel()}`));
  expect(mapped).toBeInstanceOf(ManifestEntries);
  expect([...mapped].map((value) => value.rel())).toEqual(["mapped/a.ts", "mapped/b.ts"]);
  expect([...entries].map((value) => value.rel())).toEqual(["a.ts", "b.ts"]);
  expect(requireSuccess(ManifestEntries.parse([])).isEmpty()).toBe(true);
  let calls = 0;
  const empty = ManifestEntries.of([]).map((value) => {
    calls++;
    return value;
  });
  expect(empty).toBeInstanceOf(ManifestEntries);
  expect(empty.isEmpty()).toBe(true);
  expect(calls).toBe(0);
});

test("installation manifest mapping remains nonempty while selection returns ManifestEntries", () => {
  const tail = [entry("b.ts")];
  const manifest = requireSuccess(InstallationManifest.parse(entry("a.ts"), tail));
  tail.length = 0;
  let calls = 0;
  const mapped = manifest.map((value) => {
    calls++;
    return entry(`mapped/${value.rel()}`);
  });
  expect(mapped).toBeInstanceOf(InstallationManifest);
  expect(mapped.head().rel()).toBe("mapped/a.ts");
  expect([...mapped].map((value) => value.rel())).toEqual(["mapped/a.ts", "mapped/b.ts"]);
  expect(calls).toBe(2);
  expect([...manifest].map((value) => value.rel())).toEqual(["a.ts", "b.ts"]);
  expect(mapped.tail()).toBeInstanceOf(ManifestEntries);
  const selected = mapped.filter(() => false);
  expect(selected).toBeInstanceOf(ManifestEntries);
  expect(selected.isEmpty()).toBe(true);
  const single = InstallationManifest.of(entry("one.ts"), []).map((value) => entry(`mapped/${value.rel()}`));
  expect(single.head().rel()).toBe("mapped/one.ts");
  expect(single.tail().isEmpty()).toBe(true);
});

test("manifest factories enforce their size budget with panic and nonexception parse errors", () => {
  const head = entry("a.ts");
  const tooManyEntries = Array.from({ length: 65_537 }, () => head);
  const tooManyTail = Array.from({ length: 65_536 }, () => head);
  expect(() => ManifestEntries.of(tooManyEntries)).toThrow(IllegalArgumentException);
  expect(() => InstallationManifest.of(head, tooManyTail)).toThrow(IllegalArgumentException);
  const entries = ManifestEntries.parse(tooManyEntries);
  const manifest = InstallationManifest.parse(head, tooManyTail);
  for (const parsed of [entries, manifest]) {
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
});

test("combining manifest collections preserves order, nonemptiness, and original values", () => {
  const left = InstallationManifest.of(entry("a.ts"), []);
  const right = InstallationManifest.of(entry("b.ts"), [entry("c.ts")]);
  const combined = left.combine(right);
  expect(combined).toBeInstanceOf(InstallationManifest);
  expect(combined).not.toBe(left);
  expect([...combined].map((value) => value.rel())).toEqual(["a.ts", "b.ts", "c.ts"]);
  expect([...left].map((value) => value.rel())).toEqual(["a.ts"]);
  expect([...right].map((value) => value.rel())).toEqual(["b.ts", "c.ts"]);
  const values = ManifestEntries.of([entry("x.ts")]);
  const empty = ManifestEntries.of([]);
  expect([...values.combine(empty)].map((value) => value.rel())).toEqual(["x.ts"]);
  expect([...empty.combine(values)].map((value) => value.rel())).toEqual(["x.ts"]);
  expect(empty.combine(empty).isEmpty()).toBe(true);
  expect([...values.combine(values)].map((value) => value.rel())).toEqual(["x.ts", "x.ts"]);
});

test("combination cannot exceed the manifest collection budget", () => {
  const value = entry("a.ts");
  const maximum = ManifestEntries.of(Array.from({ length: 65_536 }, () => value));
  expect(() => maximum.combine(ManifestEntries.of([value]))).toThrow(IllegalArgumentException);
  const manifest = InstallationManifest.of(
    value,
    Array.from({ length: 65_535 }, () => value),
  );
  expect(() => manifest.combine(InstallationManifest.of(value, []))).toThrow(IllegalArgumentException);
});
