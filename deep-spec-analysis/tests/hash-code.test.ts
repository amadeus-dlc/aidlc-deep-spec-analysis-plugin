import { describe, expect, test } from "bun:test";
import {
  combinedHash,
  hashOfBoolean,
  hashOfNullable,
  hashOfNumber,
  hashOfString,
} from "@deep-spec-analysis/kernel-infrastructure";

describe("hash code primitives", () => {
  test("string hashing follows the 31-multiplier fold", () => {
    expect(hashOfString("")).toBe(0);
    expect(hashOfString("a")).toBe(97);
    // 31 * 97 + 98
    expect(hashOfString("ab")).toBe(3105);
    expect(hashOfString("hello")).toBe(99_162_322);
  });

  test("equal strings hash equally and stay inside a 32-bit signed integer", () => {
    const long = "x".repeat(10_000);
    const hash = hashOfString(long);
    expect(hashOfString(long)).toBe(hash);
    expect(Number.isSafeInteger(hash)).toBe(true);
    expect(hash).toBe(hash | 0);
  });

  test("numbers that are equal hash equally, including negative zero", () => {
    expect(hashOfNumber(-0)).toBe(hashOfNumber(0));
    expect(hashOfNumber(42)).toBe(42);
    expect(hashOfNumber(-42)).toBe(-42);
    expect(hashOfNumber(1.5)).toBe(hashOfNumber(1.5));
    expect(hashOfNumber(1.5)).toBe(hashOfNumber(1.5) | 0);
  });

  test("NaN never equals itself so its hash is only required to be stable", () => {
    expect(hashOfNumber(Number.NaN)).toBe(0);
  });

  test("booleans use the same constants as Java", () => {
    expect(hashOfBoolean(true)).toBe(1231);
    expect(hashOfBoolean(false)).toBe(1237);
  });

  test("absent values collapse to a single hash", () => {
    expect(hashOfNullable(null, hashOfString)).toBe(0);
    expect(hashOfNullable(undefined, hashOfString)).toBe(0);
    expect(hashOfNullable("a", hashOfString)).toBe(97);
  });

  test("the fold starts at 1 and is order sensitive", () => {
    expect(combinedHash([])).toBe(1);
    expect(combinedHash([7])).toBe(38);
    expect(combinedHash([1, 2])).toBe(994);
    expect(combinedHash([2, 1])).not.toBe(combinedHash([1, 2]));
  });

  test("the fold stays inside a 32-bit signed integer", () => {
    const hash = combinedHash(Array.from({ length: 1000 }, (_value, index) => index));
    expect(hash).toBe(hash | 0);
  });
});
