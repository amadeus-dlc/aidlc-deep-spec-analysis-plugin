// deep-spec-ir-valid sensor — deterministic IR contract check (contract 1).
//
// Validates the formal model artifact (deep-spec-analysis-formal-model.md):
//   1. exactly one ```json fence containing the IR document;
//   2. IR conforms to tools/data/deep-spec-ir-schema.json (subset validator,
//      no external dependencies);
//   3. semantic well-formedness beyond the schema: unique ids, resolvable
//      attribute references, enum literal membership, prime legality;
//   4. every frRefs entry exists verbatim in the upstream requirements.md
//      (reverse traceability);
//   5. sourceDigest matches the sha256 of the upstream requirements.md bytes
//      (source anchoring — a drifted or missing digest is an error, and the
//      message carries the expected value so fixing it is mechanical).
//
// Sensor contract: parses only --stage / --output-path; pass-through
// (exit 0, pass:true) on writes that are not the formal model; one JSON
// verdict line on stdout; always exit 0 for a real verdict.
//
// Self-contained — no import of the framework's aidlc-lib (a plugin tool
// ships in its own delta and must not depend on a sibling core tool being
// present).
//
// 合成ルート：フラグ解釈・スキーマパスの解決・実装の結線・verdict 行の描画
// だけを持つ。検査そのものは ValidateIrUseCase（requirements/usecase）と
// well-formedness ドメイン（requirements/domain）にある。

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags } from "@deep-spec/kernel-adapter";
import { ArtifactPath } from "@deep-spec/kernel-domain";
import {
  IrValidationMaterialsRepositoryImpl,
  RequirementsSourceRepositoryImpl,
} from "@deep-spec/requirements-adapter";
import { FormalModelId } from "@deep-spec/requirements-domain";
import { ValidateIrUseCase } from "@deep-spec/requirements-usecase";

const MAX_REPORTED_ERRORS = 25;

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  if (!target.ok) {
    process.stderr.write("deep-spec-ir-valid: --output-path is required\n");
    process.exit(1);
  }

  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-ir-schema.json");
  const useCase = new ValidateIrUseCase(
    new IrValidationMaterialsRepositoryImpl({ schemaPath }),
    new RequirementsSourceRepositoryImpl(),
  );

  const outcome = useCase.execute(FormalModelId.of(target.value));
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
