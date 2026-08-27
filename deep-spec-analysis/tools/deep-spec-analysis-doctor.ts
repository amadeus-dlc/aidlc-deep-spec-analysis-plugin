// deep-spec plugin doctor — advisory environment and install checks.
//
// Contract (see docs/reference/18-plugin-mechanism.md): a single JSON object
// on stdout — {"checks":[{pass,label,fix?,severity?}]}. Severity "error"
// fails /aidlc --doctor; "advisory" is displayed only. All solver checks are
// advisory (FR11 / NFR3): a missing solver degrades verification, it never
// blocks the workflow.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.env.AIDLC_PROJECT_DIR || process.cwd();
const harnessDir = process.env.AIDLC_HARNESS_DIR || ".claude";
const root = join(projectDir, harnessDir);

interface Check {
  pass: boolean;
  label: string;
  fix?: string;
  severity: "error" | "advisory";
}

const checks: Check[] = [];

function installed(rel: string, severity: "error" | "advisory"): void {
  checks.push({
    pass: existsSync(join(root, rel)),
    label: `deep-spec-analysis: ${rel} installed`,
    fix: `Run \`bun ${harnessDir}/tools/aidlc-utility.ts plugin-sync\` (or re-run the plugin's \`hooks/compose.ts\`).`,
    severity,
  });
}

installed("sensors/aidlc-deep-spec-ir-valid.md", "error");
installed("sensors/aidlc-deep-spec-verify-smt.md", "error");
installed("sensors/aidlc-deep-spec-verify-quint.md", "error");
installed("tools/aidlc-sensor-deep-spec-ir-valid.ts", "error");
installed("tools/aidlc-sensor-deep-spec-verify-smt.ts", "error");
installed("tools/aidlc-sensor-deep-spec-verify-quint.ts", "error");
installed("tools/data/deep-spec-ir-schema.json", "error");
installed("tools/data/deep-spec-findings-schema.json", "error");
installed("knowledge/aidlc-product-agent/deep-spec-ir-authoring.md", "error");

function probe(cmd: string, args: string[]): boolean {
  const res = spawnSync(cmd, args, { encoding: "utf-8", timeout: 5000 });
  return !res.error && res.status === 0;
}

// SMT backend: z3-solver (WASM) resolved from the project, executed in a
// node child process (z3's pthread build aborts in-process under bun).
checks.push({
  pass: existsSync(join(projectDir, "node_modules", "z3-solver", "package.json")),
  label: "deep-spec-analysis: z3-solver package present (SMT backend)",
  fix: "Run `bun add z3-solver` in the project root. Without it the SMT backend reports `unavailable` and skips its checks.",
  severity: "advisory",
});
checks.push({
  pass: probe("node", ["--version"]),
  label: "deep-spec-analysis: node runtime on PATH (executes the z3 child process)",
  fix: "Install Node.js >= 23 (its TypeScript type-stripping runs the solver child). Without it the SMT backend falls back to bun, which currently aborts on z3's pthread build.",
  severity: "advisory",
});

// Quint backend.
const quintBin = process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint";
checks.push({
  pass: probe(quintBin, ["--version"]),
  label: "deep-spec-analysis: quint CLI on PATH (Quint backend)",
  fix: "Run `npm i -g @informalsystems/quint`. Without it the Quint backend reports `unavailable` and skips its checks.",
  severity: "advisory",
});

// Apalache (optional): upgrades the Quint backend from simulation to bounded.
const javaOk = probe("java", ["-version"]);
let apalacheDist = Boolean(process.env.APALACHE_DIST);
if (!apalacheDist) {
  try {
    apalacheDist = readdirSync(join(process.env.HOME ?? "", ".quint")).some((f) => f.startsWith("apalache-dist-"));
  } catch {
    apalacheDist = false;
  }
}
checks.push({
  pass: javaOk && apalacheDist,
  label: "deep-spec-analysis: Apalache available (quint verify, method: bounded)",
  fix: "Install a JDK (17+) and run any `quint verify` once so quint downloads its Apalache distribution into ~/.quint (or set APALACHE_DIST). Without it the Quint backend uses seeded simulation (method: simulation) and skips leads-to temporal obligations.",
  severity: "advisory",
});

process.stdout.write(`${JSON.stringify({ checks })}\n`);
