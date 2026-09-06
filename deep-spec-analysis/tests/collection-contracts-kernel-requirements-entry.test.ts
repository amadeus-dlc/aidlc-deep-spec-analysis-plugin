import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const applicationRoot = resolve(import.meta.dir, "..");

test.each([
  {
    backend: "smt",
    environment: "AIDLC_DEEP_SPEC_SMT_RUNTIME",
    answer: '{"results":[{"id":"global","status":"unsat","core":[]}]}',
  },
  { backend: "quint", environment: "AIDLC_DEEP_SPEC_QUINT_BIN", answer: "deadlock" },
])("$backend の公開entryは対象欠落の診断をセンサー成功として出力しない", ({ backend, environment, answer }) => {
  const directory = mkdtempSync(join(tmpdir(), "finding-targets-entry-"));
  try {
    const model = join(directory, "deep-spec-analysis-formal-model.md");
    writeFileSync(
      model,
      `\`\`\`json\n${JSON.stringify({ irVersion: "1.0.0", schema: { entities: [] }, obligations: [], scenarios: [], background: [] })}\n\`\`\`\n`,
    );
    const solver = join(directory, "solver");
    writeFileSync(solver, `#!/bin/sh\nprintf '%s\\n' '${answer}'\n`, { mode: 0o755 });
    const result = spawnSync(
      process.execPath,
      [join(applicationRoot, "src", "entries", `aidlc-sensor-deep-spec-verify-${backend}.ts`), "--output-path", model],
      {
        cwd: applicationRoot,
        env: { ...process.env, [environment]: solver, AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation" },
        encoding: "utf-8",
        timeout: 10_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const published = JSON.parse(readFileSync(join(directory, "deep-spec-verify", `${backend}.json`), "utf-8"));
    expect(published.unavailable.reason).toContain("missing-finding-targets");
    expect(published.findings).toEqual([]);
    expect(JSON.parse(result.stdout)).toMatchObject({ pass: false, findings_count: 0, skipped_count: 0 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SMTの公開entryは診断対象の上限超過をセンサー成功として出力しない", () => {
  const directory = mkdtempSync(join(tmpdir(), "finding-targets-budget-entry-"));
  try {
    const model = join(directory, "deep-spec-analysis-formal-model.md");
    const obligations = Array.from({ length: 65_537 }, (_, index) => ({
      id: `OB-${index + 1}`,
      nature: "invariant",
      frRefs: [],
      assert: { op: "bool", value: true },
    }));
    writeFileSync(
      model,
      `\`\`\`json\n${JSON.stringify({ irVersion: "1.0.0", schema: { entities: [] }, obligations, scenarios: [], background: [] })}\n\`\`\`\n`,
    );
    const solver = join(directory, "solver.ts");
    writeFileSync(
      solver,
      `#!/usr/bin/env bun
import { readFileSync } from "node:fs";
const request = JSON.parse(readFileSync(0, "utf-8"));
process.stdout.write(JSON.stringify({ results: request.queries.map((query) => ({ id: query.id, status: "unsat", core: query.assumptions })) }));
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      process.execPath,
      [join(applicationRoot, "src", "entries", "aidlc-sensor-deep-spec-verify-smt.ts"), "--output-path", model],
      {
        cwd: applicationRoot,
        env: { ...process.env, AIDLC_DEEP_SPEC_SMT_RUNTIME: solver },
        encoding: "utf-8",
        timeout: 15_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const published = JSON.parse(readFileSync(join(directory, "deep-spec-verify", "smt.json"), "utf-8"));
    expect(published.unavailable.reason).toContain("too-many-finding-targets");
    expect(published.findings).toEqual([]);
    expect(JSON.parse(result.stdout)).toMatchObject({ pass: false, findings_count: 0, skipped_count: 0 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
