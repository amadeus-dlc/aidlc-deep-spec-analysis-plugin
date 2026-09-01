import type { RefinementAttr } from "./refinement-attr.ts";


export interface RefinementSmtContext {
  attrs: RefinementAttr[]; // v1 AttrInfo と同形——ただし設計ユニットの属性
  byPath: Map<string, RefinementAttr>;
}
