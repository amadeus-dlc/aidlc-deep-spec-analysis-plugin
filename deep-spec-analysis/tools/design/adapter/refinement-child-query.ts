export interface RefinementChildQuery {
  id: string;
  script: string;
  assumptions: string[];
  model: { name: string; sort: "Int" | "Bool" }[];
}
