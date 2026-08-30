// deep-spec-design-ir-valid sensor — deterministic design-IR contract check
// (contract 3).
//
// Validates the functional formal model
// (deep-spec-analysis-functional-formal-model.md):
//   1. exactly one ```json fence containing the design IR document;
//   2. conformance to tools/data/deep-spec-design-ir-schema.json;
//   3. semantic well-formedness beyond the schema, per unit: unique ids per
//      namespace (DOB/DSC/DBG/SM/TR), resolvable attribute references, enum
//      literal membership, prime legality, machine well-formedness (the
//      lifecycle attribute is a declared enum; initial/from/to are its
//      values; ignores collide with no transition; a transition's effect
//      never assigns the machine's own attribute);
//   4. brRefs reverse-verified against each unit's rules.md, plus the BR
//      coverage rule: every BR{n}.{m} in rules.md is referenced by an
//      obligation/transition/scenario or listed in unformalized[] (the
//      design-level no-silence ledger).
//
// Sensor contract: parses only --stage / --output-path; pass-through on
// writes that are not the functional formal model; one JSON verdict line on
// stdout; always exit 0 for a real verdict.
//
// 合成ルート：フラグ解釈・スキーマパスの解決・実装の結線・verdict 行の描画
// だけを持つ。検査そのものは ValidateDesignIrUseCase（design/usecase）と
// well-formedness ドメイン（design/domain）にある。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags } from "./kernel/adapter/index.ts";
import { DesignIrValidationMaterialsRepositoryImpl } from "./design/adapter/index.ts";
import { ValidateDesignIrUseCase } from "./design/usecase/index.ts";

const MAX_REPORTED_ERRORS = 25;

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-ir-valid: --output-path is required\n");
    process.exit(1);
  }

  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-design-ir-schema.json");
  const useCase = new ValidateDesignIrUseCase(new DesignIrValidationMaterialsRepositoryImpl({ schemaPath }));

  const outcome = useCase.execute(flags.outputPath);
  if (outcome.kind === "not-applicable") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}\n`);
    process.exit(0);
  }
  process.stdout.write(
    `${JSON.stringify({
      pass: outcome.pass,
      findings_count: outcome.errors.length,
      errors: outcome.errors.slice(0, MAX_REPORTED_ERRORS),
    })}\n`,
  );
  process.exit(0);
}

main();
