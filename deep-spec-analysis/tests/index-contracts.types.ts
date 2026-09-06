import { combineResults, err, ok } from "@deep-spec-analysis/kernel-infrastructure";

const symbol = Symbol("field");
const reservedKey = "__proto__";
const symbolResult = combineResults({ [symbol]: ok(23) });
if (symbolResult.ok) {
  const value: number = symbolResult.value[symbol];
  void value;
}

const reservedResult = combineResults({ ["__proto__"]: ok({ marker: true }) });
if (reservedResult.ok) {
  const marker: boolean = reservedResult.value[reservedKey].marker;
  void marker;
}

const arrayResult = combineResults([ok(2), ok(3)]);
if (arrayResult.ok) {
  const values: number[] = arrayResult.value;
  void values;
}

const tupleResult = combineResults([ok(2), ok("three")] as const);
if (tupleResult.ok) {
  const values: readonly [number, string] = tupleResult.value;
  void values;
}

const failedSymbolResult = combineResults({ [symbol]: err<string>("failed") });
if (!failedSymbolResult.ok) {
  void failedSymbolResult.error;
}
