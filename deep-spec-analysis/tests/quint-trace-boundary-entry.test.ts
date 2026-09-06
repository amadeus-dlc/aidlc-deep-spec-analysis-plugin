import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const applicationRoot = resolve(import.meta.dir, "..");
const model = {
  irVersion: "1.0.0",
  schema: { entities: [{ name: "Account", attributes: [{ name: "active", type: { kind: "bool" } }] }] },
  obligations: [
    { id: "OB-1", nature: "invariant", frRefs: [], assert: { op: "ref", path: "Account.active" } },
    {
      id: "OB-2",
      nature: "event",
      frRefs: [],
      trigger: "tick",
      guard: { op: "bool", value: true },
      effect: {
        op: "eq",
        args: [
          { op: "ref", path: "Account.active", prime: true },
          { op: "ref", path: "Account.active" },
        ],
      },
    },
    {
      id: "OB-3",
      nature: "state-temporal",
      frRefs: [],
      temporal: { pattern: "leads-to", from: { op: "bool", value: true }, to: { op: "ref", path: "Account.active" } },
    },
  ],
  scenarios: [],
  background: [],
};

const fakeQuint = `#!/usr/bin/env bun
import { copyFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("0.32.0");
  process.exit(0);
}
const route = process.env.TRACE_TEST_ROUTE;
const temporal = args.some(arg => arg.startsWith("--temporal="));
if (route === "temporal" && !temporal) process.exit(0);
const destination = args.find(arg => arg.startsWith("--out-itf="));
if (!destination || !process.env.TRACE_TEST_FIXTURE) throw new Error("missing trace test fixture");
copyFileSync(process.env.TRACE_TEST_FIXTURE, destination.slice("--out-itf=".length));
console.log(route === "deadlock" ? "deadlock" : "violation");
`;

for (const route of ["deadlock", "violation", "temporal"] as const) {
  for (const limit of ["entries", "states"] as const) {
    test(`${route}: ITFの${limit}超過を例外にせず、対象の未検証理由として公開する`, () => {
      const directory = mkdtempSync(join(tmpdir(), "quint-trace-boundary-"));
      try {
        const modelPath = join(directory, "deep-spec-analysis-formal-model.md");
        writeFileSync(modelPath, `\`\`\`json\n${JSON.stringify(model)}\n\`\`\`\n`);
        const tracePath = join(directory, "trace.json");
        const states =
          limit === "entries"
            ? [Object.fromEntries(Array.from({ length: 65_537 }, (_, index) => [`Account.a${index}`, true]))]
            : Array.from({ length: 65_537 }, () => ({}));
        const trace = JSON.stringify({ "#meta": { status: "violation" }, states });
        expect(trace.length).toBeLessThan(16_777_216);
        writeFileSync(tracePath, trace);
        const solverPath = join(directory, "quint");
        writeFileSync(solverPath, fakeQuint, { mode: 0o755 });
        const result = spawnSync(
          process.execPath,
          [join(applicationRoot, "src/entries/aidlc-sensor-deep-spec-verify-quint.ts"), "--output-path", modelPath],
          {
            cwd: applicationRoot,
            encoding: "utf-8",
            timeout: 15_000,
            env: {
              ...process.env,
              AIDLC_DEEP_SPEC_QUINT_BIN: solverPath,
              AIDLC_DEEP_SPEC_QUINT_METHOD: route === "temporal" ? "bounded" : "simulation",
              TRACE_TEST_ROUTE: route,
              TRACE_TEST_FIXTURE: tracePath,
            },
          },
        );
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        const published = JSON.parse(readFileSync(join(directory, "deep-spec-verify/quint.json"), "utf-8"));
        expect(published.findings).toEqual([]);
        const target = route === "temporal" ? "OB-3" : "OB-1";
        const skipped = published.skipped.find((item: { target: string }) => item.target === target);
        expect(skipped).toBeDefined();
        expect(skipped.reason).toBe("unavailable");
        expect(skipped.detail).toContain(
          limit === "entries" ? "too-many-trace-state-entries" : "too-many-trace-states",
        );
        expect(JSON.parse(result.stdout).skipped_count).toBeGreaterThan(0);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}
