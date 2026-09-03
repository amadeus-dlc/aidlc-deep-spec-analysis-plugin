export interface RefinementAttr {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
}
