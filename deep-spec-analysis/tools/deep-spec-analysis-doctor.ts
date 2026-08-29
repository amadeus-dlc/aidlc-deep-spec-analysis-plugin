// deep-spec plugin doctor — advisory environment and install checks.
//
// Contract (see docs/reference/18-plugin-mechanism.md): a single JSON object
// on stdout — {"checks":[{pass,label,fix?,severity?}]}. Severity "error"
// fails /aidlc --doctor; "advisory" is displayed only. All solver checks are
// advisory (FR11 / NFR3): a missing solver degrades verification, it never
// blocks the workflow.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
installed("sensors/aidlc-deep-spec-refcheck-domain.md", "error");
installed("sensors/aidlc-deep-spec-refcheck-contract.md", "error");
installed("sensors/aidlc-deep-spec-refcheck-functional.md", "error");
installed("tools/aidlc-sensor-deep-spec-refcheck-domain.ts", "error");
installed("tools/aidlc-sensor-deep-spec-refcheck-contract.ts", "error");
installed("tools/aidlc-sensor-deep-spec-refcheck-functional.ts", "error");
// コンテキストごとの canary（DDD 移行 — facade が在ればツリーが運ばれている）
installed("tools/kernel/domain/index.ts", "error");
installed("tools/kernel/usecase/index.ts", "error");
installed("tools/kernel/adapter/index.ts", "error");
installed("tools/refcheck/domain/index.ts", "error");
installed("tools/refcheck/usecase/index.ts", "error");
installed("tools/refcheck/adapter/index.ts", "error");
installed("sensors/aidlc-deep-spec-design-ir-valid.md", "error");
installed("sensors/aidlc-deep-spec-design-verify-smt.md", "error");
installed("sensors/aidlc-deep-spec-design-verify-quint.md", "error");
installed("tools/aidlc-sensor-deep-spec-design-ir-valid.ts", "error");
installed("tools/aidlc-sensor-deep-spec-design-verify-smt.ts", "error");
installed("tools/aidlc-sensor-deep-spec-design-verify-quint.ts", "error");
installed("tools/deep-spec-design-lib.ts", "error");
installed("tools/data/deep-spec-design-ir-schema.json", "error");
installed("knowledge/aidlc-architect-agent/deep-spec-design-ir-authoring.md", "error");
installed("tools/deep-spec-refinement-lib.ts", "error");
installed("tools/data/deep-spec-refinement-map-schema.json", "error");
installed("knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md", "error");

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

// Verification coverage: enumerate every intent whose scope the stage serves
// and whose requirements exist, and flag the ones with no (or stale) deep-spec
// verification. This is what makes late adoption safe — a project that
// installs the plugin mid-flight is TOLD which requirements are unverified
// instead of having to remember. Advisory: coverage debt never blocks.
const FALLBACK_STAGE_SCOPES = ["enterprise", "feature"];

function scopesOfStage(...stagePath: string[]): string[] {
  const stageFile = join(root, "aidlc-common", "stages", ...stagePath);
  try {
    const frontmatter = readFileSync(stageFile, "utf-8").split("\n---")[0];
    const m = frontmatter.match(/^scopes:\n((?:\s+- .+\n)+)/m);
    if (m) return m[1].match(/- (\S+)/g)!.map((s) => s.slice(2));
  } catch {
    // fall through to the authored default
  }
  return FALLBACK_STAGE_SCOPES;
}

function stageScopes(): string[] {
  return scopesOfStage("inception", "deep-spec-analysis-verify.md");
}

interface CoverageRow {
  space: string;
  intent: string;
  state: "unverified" | "stale";
}

function scanVerificationCoverage(): { eligible: number; problems: CoverageRow[] } {
  const problems: CoverageRow[] = [];
  let eligible = 0;
  const scopes = new Set(stageScopes());
  const spacesDir = join(projectDir, "aidlc", "spaces");
  let spaces: string[] = [];
  try {
    spaces = readdirSync(spacesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { eligible, problems };
  }
  for (const space of spaces) {
    const intentsDir = join(spacesDir, space, "intents");
    let intents: string[] = [];
    try {
      intents = readdirSync(intentsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const intent of intents) {
      const record = join(intentsDir, intent);
      let state = "";
      try {
        state = readFileSync(join(record, "aidlc-state.md"), "utf-8");
      } catch {
        continue;
      }
      const scope = state.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1];
      if (!scope || !scopes.has(scope)) continue;
      const requirements = join(record, "inception", "requirements-analysis", "requirements.md");
      if (!existsSync(requirements)) continue;
      eligible += 1;
      const model = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
      const verifyDir = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify");
      let hasFindings = false;
      try {
        hasFindings = readdirSync(verifyDir).some((f) => f.endsWith(".json"));
      } catch {
        hasFindings = false;
      }
      if (!existsSync(model) || !hasFindings) {
        problems.push({ space, intent, state: "unverified" });
      } else {
        // Content-based staleness: when the formal model carries a
        // sourceDigest, compare it against the sha256 of the current
        // requirements.md bytes — an edit is caught even if mtimes lie
        // (git checkouts, touch). Models from before the anchor existed
        // fall back to the mtime heuristic; their next re-verification
        // stamps the digest (deep-spec-ir-valid enforces it).
        const anchored = readFileSync(model, "utf-8")
          .match(/```json\n([\s\S]*?)```/)?.[1]
          ?.match(/"sourceDigest"\s*:\s*"([0-9a-f]{64})"/)?.[1];
        const drifted = anchored
          ? createHash("sha256").update(readFileSync(requirements)).digest("hex") !== anchored
          : statSync(requirements).mtimeMs > statSync(model).mtimeMs;
        if (drifted) problems.push({ space, intent, state: "stale" });
      }
    }
  }
  return { eligible, problems };
}

const coverage = scanVerificationCoverage();
for (const row of coverage.problems) {
  const noun = row.state === "unverified"
    ? "has requirements with no deep-spec verification"
    : "changed its requirements after the last deep-spec verification";
  checks.push({
    pass: false,
    label: `deep-spec-analysis: intent ${row.space}/${row.intent} ${noun}`,
    fix:
      `Make it the active intent (\`bun ${harnessDir}/tools/aidlc-utility.ts intent ${row.intent}\`), ` +
      "then run `/aidlc --stage deep-spec-analysis-verify --single` to verify its requirements without advancing the workflow.",
    severity: "advisory",
  });
}
checks.push({
  pass: coverage.problems.length === 0,
  label:
    `deep-spec-analysis: verification coverage — ${coverage.eligible - coverage.problems.length}/${coverage.eligible} ` +
    "eligible intents verified (scopes: " + stageScopes().join(", ") + ")",
  fix: "See the per-intent rows above for the exact command each unverified intent needs.",
  severity: "advisory",
});

// Structural-debt scan (phase 1, report-only): run the deep-spec-refcheck
// tools against every existing design artifact without writing anything, so
// a late adopter sees reference/structure debt from the very first doctor
// run — before any stage ever fires a sensor. Advisory: debt never blocks.
interface DebtRow {
  space: string;
  intent: string;
  artifact: string;
  findings: number;
}

function refcheckReportOnly(tool: string, artifactPath: string): number | null {
  const script = join(root, "tools", tool);
  if (!existsSync(script)) return null;
  const res = spawnSync("bun", [script, "--stage", "doctor", "--output-path", artifactPath, "--report-only"], {
    encoding: "utf-8",
    timeout: 15_000,
  });
  if (res.error || res.status !== 0) return null;
  try {
    const lines = (res.stdout ?? "").trim().split("\n");
    const verdict = JSON.parse(lines[lines.length - 1] ?? "{}") as { findings_count?: number };
    return typeof verdict.findings_count === "number" ? verdict.findings_count : null;
  } catch {
    return null;
  }
}

function scanDesignDebt(): { scanned: number; rows: DebtRow[] } {
  const rows: DebtRow[] = [];
  let scanned = 0;
  const spacesDir = join(projectDir, "aidlc", "spaces");
  let spaces: string[] = [];
  try {
    spaces = readdirSync(spacesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { scanned, rows };
  }
  for (const space of spaces) {
    const intentsDir = join(spacesDir, space, "intents");
    let intents: string[] = [];
    try {
      intents = readdirSync(intentsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const intent of intents) {
      const record = join(intentsDir, intent);
      const scan = (tool: string, artifactPath: string, label: string): void => {
        if (!existsSync(artifactPath)) return;
        const findings = refcheckReportOnly(tool, artifactPath);
        if (findings === null) return;
        scanned += 1;
        if (findings > 0) rows.push({ space, intent, artifact: label, findings });
      };
      scan("aidlc-sensor-deep-spec-refcheck-domain.ts", join(record, "inception", "domain-design", "components.md"),
        "inception/domain-design/components.md");
      scan("aidlc-sensor-deep-spec-refcheck-contract.ts", join(record, "inception", "contract-design", "contract-summary.md"),
        "inception/contract-design/contract-summary.md");
      const constructionDir = join(record, "construction");
      let units: string[] = [];
      try {
        units = readdirSync(constructionDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort();
      } catch {
        units = [];
      }
      for (const unit of units) {
        const fdDir = join(constructionDir, unit, "functional-design");
        const trigger = ["entities.md", "rules.md", "functional-spec.md"]
          .map((f) => join(fdDir, f))
          .find((p) => existsSync(p));
        if (trigger !== undefined) {
          scan("aidlc-sensor-deep-spec-refcheck-functional.ts", trigger, `construction/${unit}/functional-design`);
        }
      }
    }
  }
  return { scanned, rows };
}

const debt = scanDesignDebt();
for (const row of debt.rows) {
  checks.push({
    pass: false,
    label: `deep-spec-analysis: ${row.space}/${row.intent} ${row.artifact} has ${row.findings} reference-integrity finding(s)`,
    fix:
      "Open the artifact and fix (or record as an accepted risk) each finding; " +
      "the deep-spec-refcheck sensors re-check on every write and write the detail next to the artifact under deep-spec-refcheck/.",
    severity: "advisory",
  });
}
if (debt.scanned > 0) {
  const total = debt.rows.reduce((n, r) => n + r.findings, 0);
  checks.push({
    pass: total === 0,
    label: `deep-spec-analysis: design refcheck — ${total} structural finding(s) across ${debt.scanned} design artifact(s) scanned (report-only)`,
    fix: "See the per-artifact rows above.",
    severity: "advisory",
  });
}

// Design verification coverage (phase 2): per-unit. A unit is verified when
// it appears in the units[] manifest of the functional formal model AND the
// stage record carries backend findings; stale when any of its three design
// artifacts changed after the model was written. Advisory, like everything
// else: coverage debt never blocks.
interface UnitCoverageRow {
  space: string;
  intent: string;
  unit: string;
  state: "unverified" | "stale";
}

function scanFunctionalCoverage(): { eligible: number; problems: UnitCoverageRow[] } {
  const problems: UnitCoverageRow[] = [];
  let eligible = 0;
  const scopes = new Set(scopesOfStage("construction", "deep-spec-analysis-functional-verify.md"));
  const spacesDir = join(projectDir, "aidlc", "spaces");
  let spaces: string[] = [];
  try {
    spaces = readdirSync(spacesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { eligible, problems };
  }
  for (const space of spaces) {
    const intentsDir = join(spacesDir, space, "intents");
    let intents: string[] = [];
    try {
      intents = readdirSync(intentsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const intent of intents) {
      const record = join(intentsDir, intent);
      let state = "";
      try {
        state = readFileSync(join(record, "aidlc-state.md"), "utf-8");
      } catch {
        continue;
      }
      const scope = state.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1];
      if (!scope || !scopes.has(scope)) continue;
      const constructionDir = join(record, "construction");
      let unitDirs: string[] = [];
      try {
        unitDirs = readdirSync(constructionDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && existsSync(join(constructionDir, e.name, "functional-design")))
          .map((e) => e.name)
          .sort();
      } catch {
        continue;
      }
      if (unitDirs.length === 0) continue;
      const stageDir = join(constructionDir, "deep-spec-analysis-functional-verify");
      const modelPath = join(stageDir, "deep-spec-analysis-functional-formal-model.md");
      let modelUnits = new Set<string>();
      let modelMtime = 0;
      // Per-unit completion evidence: a unit is verified only when a real
      // backend document (not cross-check, not unavailable) lists it in
      // checked[] — a clean unit and a unit the backends never reached are
      // different things (PR #7 review follow-up).
      const completedUnits = new Set<string>();
      let hasFindings = false;
      if (existsSync(modelPath)) {
        try {
          modelMtime = statSync(modelPath).mtimeMs;
          const fence = readFileSync(modelPath, "utf-8").match(/```json\n([\s\S]*?)```/);
          const ir = fence ? JSON.parse(fence[1] ?? "{}") : {};
          for (const u of Array.isArray(ir.units) ? ir.units : []) {
            if (u && typeof u.unit === "string") modelUnits.add(u.unit);
          }
        } catch {
          modelUnits = new Set();
        }
        try {
          const verifyDir = join(stageDir, "deep-spec-design-verify");
          for (const f of readdirSync(verifyDir)) {
            if (!f.endsWith(".json") || f === "cross-check.json") continue;
            try {
              const doc = JSON.parse(readFileSync(join(verifyDir, f), "utf-8"));
              if (doc && typeof doc === "object" && !doc.unavailable) {
                hasFindings = true;
                for (const t of Array.isArray(doc.checked) ? doc.checked : []) {
                  if (typeof t === "string" && t.startsWith("unit:")) completedUnits.add(t.slice(5));
                }
              }
            } catch {
              // unreadable sibling — its writer reports its own state
            }
          }
        } catch {
          hasFindings = false;
        }
      }
      for (const unit of unitDirs) {
        eligible += 1;
        if (!modelUnits.has(unit) || !hasFindings || !completedUnits.has(unit)) {
          problems.push({ space, intent, unit, state: "unverified" });
          continue;
        }
        const fdDir = join(constructionDir, unit, "functional-design");
        let newest = 0;
        for (const f of ["entities.md", "rules.md", "functional-spec.md"]) {
          const p = join(fdDir, f);
          if (existsSync(p)) newest = Math.max(newest, statSync(p).mtimeMs);
        }
        if (newest > modelMtime) problems.push({ space, intent, unit, state: "stale" });
      }
      // refinement-stale (phase 3): the requirements were re-verified AFTER
      // the design verification — its refinement evidence no longer speaks
      // for the current requirements.
      const reqModel = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
      if (modelMtime > 0 && hasFindings && existsSync(reqModel) && statSync(reqModel).mtimeMs > modelMtime) {
        checks.push({
          pass: false,
          label: `deep-spec-analysis: intent ${space}/${intent} re-verified its requirements after the last design verification (refinement evidence is stale)`,
          fix:
            `Make it the active intent (\`bun ${harnessDir}/tools/aidlc-utility.ts intent ${intent}\`), ` +
            "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to re-check the design against the current requirements.",
          severity: "advisory",
        });
      }
    }
  }
  return { eligible, problems };
}

const functionalCoverage = scanFunctionalCoverage();
for (const row of functionalCoverage.problems) {
  const noun = row.state === "unverified"
    ? "has functional-design artifacts with no deep-spec design verification"
    : "changed its functional-design artifacts after the last design verification";
  checks.push({
    pass: false,
    label: `deep-spec-analysis: unit ${row.space}/${row.intent}/${row.unit} ${noun}`,
    fix:
      `Make it the active intent (\`bun ${harnessDir}/tools/aidlc-utility.ts intent ${row.intent}\`), ` +
      "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to verify its functional design without advancing the workflow.",
    severity: "advisory",
  });
}
if (functionalCoverage.eligible > 0) {
  checks.push({
    pass: functionalCoverage.problems.length === 0,
    label:
      `deep-spec-analysis: design verification coverage — ${functionalCoverage.eligible - functionalCoverage.problems.length}/${functionalCoverage.eligible} ` +
      "eligible units verified (scopes: " + scopesOfStage("construction", "deep-spec-analysis-functional-verify.md").join(", ") + ")",
    fix: "See the per-unit rows above for the exact command each unverified unit needs.",
    severity: "advisory",
  });
}

process.stdout.write(`${JSON.stringify({ checks })}\n`);
