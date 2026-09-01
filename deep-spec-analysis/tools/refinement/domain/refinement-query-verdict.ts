import type { DesignValue } from "../../design/domain/index.ts";
import type { RefinementQueryStatus } from "./refinement-query-status.ts";

export interface RefinementQueryVerdict {
  readonly status: RefinementQueryStatus;
  readonly decodedModel?: { [path: string]: DesignValue };
  readonly decodedPostModel?: { [path: string]: DesignValue };
  readonly core?: string[];
}
