// refcheck skip 記録（無沈黙台帳の 1 行）。deep-spec-lib.ts からの逐語移動。

export interface Skipped {
  target: string;
  reason: string;
  unit?: string;
  detail?: string;
}
