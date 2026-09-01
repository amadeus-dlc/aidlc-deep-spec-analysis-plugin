import type { SmtQueryStatus } from "./smt-query-status.ts";

export interface SmtQueryVerdict {
  readonly status: SmtQueryStatus;
  readonly decodedModel?: { [path: string]: boolean | number | string };
  readonly core?: string[];
}
