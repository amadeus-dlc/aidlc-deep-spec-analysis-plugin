import type { RefinementAttributeParam } from "./refinement-attribute-param.ts";


export interface RefinementSatisfiabilityModuloTheoriesContext {
  attrs: RefinementAttributeParam[]; // v1 AttrInfo と同形——ただし設計ユニットの属性
  byPath: Map<string, RefinementAttributeParam>;
}
