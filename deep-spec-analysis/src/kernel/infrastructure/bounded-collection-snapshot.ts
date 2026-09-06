import { IllegalArgumentException } from "./illegal-argument-exception.ts";

/** 配列長と実際の反復結果を同じ上限で確認してから不変snapshotを作る。 */
export function boundedCollectionSnapshot<E>(values: readonly E[], maximum: number, problemKind: string): readonly E[] {
  if (values.length > maximum) throw new IllegalArgumentException({ kind: problemKind, raw: values.length });
  const snapshot: E[] = [];
  let inspected = 0;
  for (const value of values) {
    if (inspected >= maximum) throw new IllegalArgumentException({ kind: problemKind, raw: inspected + 1 });
    inspected++;
    snapshot.push(value);
  }
  return Object.freeze(snapshot);
}
