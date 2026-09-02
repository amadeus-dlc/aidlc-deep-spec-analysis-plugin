import type { DebtRow } from "./debt-row.ts";

// 構造負債の査定集約（phase 1、report-only）——走査済み成果物数と負債行。
// センサーが一度も発火していない late adopter にも、最初の doctor 実行で
// 参照・構造の負債が見える。
export class StructuralDebt {
  readonly #scanned: number;
  readonly #rows: readonly DebtRow[];

  private constructor(props: { scanned: number; rows: readonly DebtRow[] }) {
    this.#scanned = props.scanned;
    this.#rows = props.rows;
  }

  static of(props: { scanned: number; rows: readonly DebtRow[] }): StructuralDebt {
    return new StructuralDebt({ scanned: props.scanned, rows: [...props.rows] });
  }

  hasScans(): boolean {
    return this.#scanned > 0;
  }

  scannedCount(): number {
    return this.#scanned;
  }

  totalFindings(): number {
    return this.#rows.reduce((n, r) => n + r.findingCount(), 0);
  }

  rows(): readonly DebtRow[] {
    return this.#rows;
  }
}
