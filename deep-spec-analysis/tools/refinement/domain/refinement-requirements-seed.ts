import type { ContentHash } from "../../kernel/domain/index.ts";
import type { FormalModelId } from "../../requirements/domain/index.ts";
import { RefinementAttributes } from "./refinement-attributes.ts";
import { RefinementObligations } from "./refinement-obligations.ts";
import { RefinementScenarios } from "./refinement-scenarios.ts";

export interface RefinementRequirementsSeed {
  readonly id: FormalModelId;
  readonly hash: ContentHash;
  readonly attributes: RefinementAttributes;
  readonly obligations: RefinementObligations;
  readonly scenarios: RefinementScenarios;
}
