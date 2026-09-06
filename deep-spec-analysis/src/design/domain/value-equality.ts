import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { canonicalStringify } from "@deep-spec-analysis/kernel-infrastructure";

export function sameArray<T>(left: readonly T[], right: readonly T[], equals: (left: T, right: T) => boolean): boolean {
  return left.length === right.length && left.every((value, index) => equals(value, right[index]));
}

export function sameIterable<T>(
  left: Iterable<T>,
  right: Iterable<T>,
  equals: (left: T, right: T) => boolean,
): boolean {
  return sameArray([...left], [...right], equals);
}

export function sameOptional<T>(
  left: T | undefined,
  right: T | undefined,
  equals: (left: T, right: T) => boolean,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return equals(left, right);
}

export function sameExpression(left: Expression | undefined, right: Expression | undefined): boolean {
  // 各所有者が構築時にExpressionTreeで検証したスナップショットを、式の既存正準比較器へ委譲する。
  return sameOptional(left, right, (a, b) => canonicalStringify(a) === canonicalStringify(b));
}

export function sameRecord(
  left: { readonly [key: string]: boolean | number | string },
  right: { readonly [key: string]: boolean | number | string },
): boolean {
  const keys = Object.keys(left).sort();
  const otherKeys = Object.keys(right).sort();
  return sameArray(keys, otherKeys, (a, b) => a === b) && keys.every((key) => Object.is(left[key], right[key]));
}
