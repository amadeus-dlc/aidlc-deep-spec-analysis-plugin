import type { Expression } from "../../kernel/domain/index.ts";
import type { AttributePath } from "../../requirements/domain/index.ts";

export type AttributeMapping =
  | { readonly kind: "expression"; readonly req: AttributePath; readonly expr: Expression }
  | { readonly kind: "enum-cases"; readonly req: AttributePath; readonly from: string; readonly cases: { readonly [designValue: string]: string } }
  | { readonly kind: "unspecified"; readonly req: AttributePath };
