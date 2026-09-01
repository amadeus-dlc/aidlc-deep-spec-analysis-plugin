import type { AttributeBound, AttributePath } from "../../requirements/domain/index.ts";
import { ReqAttributeValues } from "./req-attribute-values.ts";

export interface RefinementAttribute {
  path: AttributePath;
  kind: "bool" | "int" | "enum";
  min?: AttributeBound;
  max?: AttributeBound;
  values?: ReqAttributeValues;
}
