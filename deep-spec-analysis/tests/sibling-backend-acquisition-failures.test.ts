import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DesignModelRepositoryImplementation,
  SiblingBackendClientImplementation,
} from "@deep-spec-analysis/design-adapter";
import {
  DesignModelIdentifier,
  DesignReport,
  DesignReportIdentifier,
  ReachabilityPlan,
  ReachabilityVerdict,
} from "@deep-spec-analysis/design-domain";
import { ArtifactPath, VerificationMethod } from "@deep-spec-analysis/kernel-domain";
import { requireSuccess } from "./result-fixtures.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = join(
  pluginRoot,
  "tests/fixtures/refinement/record/construction/deep-spec-analysis-functional-verify/deep-spec-analysis-functional-formal-model.md",
);
const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture() {
  const acquired = new DesignModelRepositoryImplementation().findById(
    DesignModelIdentifier.of(ArtifactPath.of(modelPath)),
  );
  if (!acquired.ok) throw new Error(`fixture model failed: ${JSON.stringify(acquired.error)}`);
  const unit = acquired.value.units().toArray()[0];
  if (unit === undefined) throw new Error("fixture model has no unit");
  return { model: acquired.value, unit, lowered: requireSuccess(unit.lowered({ synthetics: false })) };
}

function fakeTool(action: "directory" | "invalid-json"): string {
  const directory = mkdtempSync(join(tmpdir(), "sibling-backend-acquisition-"));
  temporaryPaths.push(directory);
  const tool = join(directory, "fake-backend.ts");
  writeFileSync(
    tool,
    `import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const model = process.argv[process.argv.indexOf("--output-path") + 1];
const output = join(dirname(model), "deep-spec-verify", "quint.json");
${
  action === "directory"
    ? `mkdirSync(output, { recursive: true });`
    : `mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, "{ invalid json");`
}
`,
  );
  return tool;
}

function adapter(tool: string): SiblingBackendClientImplementation {
  return new SiblingBackendClientImplementation({
    siblingToolPaths: { smt: tool, quint: tool },
    workingDirectory: pluginRoot,
  });
}

describe("SiblingBackendClient の findings 読込失敗", () => {
  test.each(["directory", "invalid-json"] as const)("%s を incomplete として理由付きで上流へ渡す", (action) => {
    const { model, unit, lowered } = fixture();
    const result = adapter(fakeTool(action)).runLowered("quint", unit, lowered, 5_000);
    expect(result.isBackendUnavailable()).toBe(false);
    expect(result.canInspectReachability()).toBe(false);

    const report = result.recordedIn(
      DesignReport.started(
        DesignReportIdentifier.of(ArtifactPath.of(join(tmpdir(), "sibling-backend-report")), "quint"),
        model,
        VerificationMethod.of("simulation"),
      ),
      model,
      unit,
      lowered,
    );
    expect(
      [...report.skipped()].some((skip) => skip.detail()?.includes(action === "directory" ? "io-failed" : "corrupt")),
    ).toBe(true);
  });

  test("到達性プローブの読込失敗は未検証へ写像する", () => {
    const { unit, lowered } = fixture();
    const plan = [...ReachabilityPlan.forUnit(unit, lowered, VerificationMethod.of("bounded"))][0];
    if (plan === undefined) throw new Error("fixture has no reachability machine");
    const probe = [...plan][0];
    if (probe === undefined) throw new Error("fixture has no reachability probe");

    const verdict = adapter(fakeTool("directory")).probeState(probe, 5_000);
    expect(verdict.equals(ReachabilityVerdict.unverified())).toBe(true);
  });
});
