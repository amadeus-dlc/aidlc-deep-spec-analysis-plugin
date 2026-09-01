import { RuleDecls } from "./rule-decls.ts";
export type RulesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "no-rules-list" }
  | { readonly kind: "extracted"; readonly rules: RuleDecls };
