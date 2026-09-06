import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ArtifactPath, FindingsSchema } from "@deep-spec-analysis/kernel-domain";
import { err, ok } from "@deep-spec-analysis/kernel-infrastructure";
import { DesignRecordIdentifier } from "@deep-spec-analysis/refcheck-domain";
import {
  CheckContractSummaryUseCase,
  CheckDomainComponentsUseCase,
  CheckFunctionalDesignUseCase,
  type DesignRecordRepository,
  type ReferenceCheckReportRepository,
} from "@deep-spec-analysis/refcheck-usecase";

const id = DesignRecordIdentifier.of(ArtifactPath.of("/record/components.md"));
const reportDirectory = ArtifactPath.of("/record/deep-spec-refcheck");
const findingsSchema = FindingsSchema.unreadable("test schema");
const acquisitionError = { kind: "corrupt" as const, path: "/record", cause: "unit-name-too-long" };

function repositories(): {
  designRecords: DesignRecordRepository;
  reports: ReferenceCheckReportRepository;
  stored: { value: boolean };
} {
  const stored = { value: false };
  return {
    designRecords: {
      findById: () => err(acquisitionError),
      store: () => ok(undefined),
    },
    reports: {
      findById: () => err({ kind: "not-found", path: "/record" }),
      store: () => {
        stored.value = true;
        return ok(undefined);
      },
    },
    stored,
  };
}

test("repository corruption is acquisition-failed across all refcheck use cases", () => {
  for (const execute of [
    (records: DesignRecordRepository, reports: ReferenceCheckReportRepository) =>
      new CheckDomainComponentsUseCase(records, reports, findingsSchema).execute({
        recordId: id,
        reportDirectory,
        mode: "persist",
      }),
    (records: DesignRecordRepository, reports: ReferenceCheckReportRepository) =>
      new CheckContractSummaryUseCase(records, reports, findingsSchema).execute({
        recordId: id,
        reportDirectory,
        mode: "persist",
      }),
    (records: DesignRecordRepository, reports: ReferenceCheckReportRepository) =>
      new CheckFunctionalDesignUseCase(records, reports, findingsSchema).execute({
        recordId: id,
        reportDirectory,
        mode: "persist",
      }),
  ]) {
    const { designRecords, reports, stored } = repositories();
    const outcome = execute(designRecords, reports);
    expect(outcome).toEqual({ kind: "acquisition-failed", error: acquisitionError });
    expect(stored.value).toBe(false);
  }
});

test("repository absence remains not-applicable", () => {
  const designRecords: DesignRecordRepository = {
    findById: () => err({ kind: "not-found", path: "/record" }),
    store: () => ok(undefined),
  };
  const reports: ReferenceCheckReportRepository = {
    findById: () => err({ kind: "not-found", path: "/record" }),
    store: () => ok(undefined),
  };
  const outcome = new CheckDomainComponentsUseCase(designRecords, reports, findingsSchema).execute({
    recordId: id,
    reportDirectory,
    mode: "persist",
  });
  expect(outcome).toEqual({ kind: "not-applicable" });
});

test("functional entry reports an invalid unit directory instead of not-applicable", () => {
  const root = mkdtempSync(join(tmpdir(), "refcheck-entry-acquisition-"));
  try {
    const unit = "u".repeat(129);
    const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
    const artifact = join(record, "construction", unit, "functional-design", "entities.md");
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(join(record, "aidlc-state.md"), "state\n");
    writeFileSync(artifact, "entities\n");
    const entry = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "entries",
      "aidlc-sensor-deep-spec-refcheck-functional.ts",
    );
    const run = spawnSync("bun", [entry, "--stage", "refcheck", "--output-path", artifact, "--report-only"], {
      encoding: "utf-8",
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("unit-name-too-long");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
