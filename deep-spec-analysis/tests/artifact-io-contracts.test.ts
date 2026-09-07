import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation,
  DesignModelRepositoryImplementation,
} from "@deep-spec-analysis/design-adapter";
import {
  DesignIntermediateRepresentationValidationMaterialsIdentifier,
  DesignModelIdentifier,
} from "@deep-spec-analysis/design-domain";
import {
  readArtifactBytes,
  readArtifactStat,
  readArtifactText,
  readDirectory,
} from "@deep-spec-analysis/kernel-adapter";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import {
  FormalModelRepositoryImplementation,
  IntermediateRepresentationValidationMaterialsRepositoryImplementation,
} from "@deep-spec-analysis/requirements-adapter";
import {
  FormalModelIdentifier,
  IntermediateRepresentationValidationMaterialsIdentifier,
} from "@deep-spec-analysis/requirements-domain";

function temporaryDirectory(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("artifact I/O distinguishes ENOENT from EISDIR and ENOTDIR", () => {
  const directory = temporaryDirectory("artifact-io-basic-");
  try {
    const file = join(directory, "file");
    writeFileSync(file, "data");
    const missing = readArtifactBytes(join(directory, "missing"));
    const directoryRead = readArtifactBytes(directory);
    const parentFile = join(directory, "parent");
    writeFileSync(parentFile, "file");
    const nonDirectory = readArtifactText(join(parentFile, "child"));

    expect(missing).toEqual({ ok: false, error: { kind: "not-found", path: join(directory, "missing") } });
    expect(directoryRead.ok).toBe(false);
    if (!directoryRead.ok) expect(directoryRead.error.kind).toBe("io-failed");
    expect(nonDirectory.ok).toBe(false);
    if (!nonDirectory.ok) expect(nonDirectory.error.kind).toBe("io-failed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)("artifact I/O keeps EACCES as io-failed", () => {
  const directory = temporaryDirectory("artifact-io-eacces-");
  const privateDirectory = join(directory, "private");
  mkdirSync(privateDirectory);
  try {
    chmodSync(privateDirectory, 0o000);
    const result = readDirectory(privateDirectory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("io-failed");
  } finally {
    chmodSync(privateDirectory, 0o700);
    rmSync(directory, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "model repositories preserve unreadable artifact failures",
  () => {
    const directory = temporaryDirectory("artifact-repository-eacces-");
    const privateDirectory = join(directory, "private");
    mkdirSync(privateDirectory);
    const formalPath = join(privateDirectory, "deep-spec-analysis-formal-model.md");
    const designPath = join(privateDirectory, "deep-spec-analysis-functional-formal-model.md");
    writeFileSync(formalPath, "model");
    writeFileSync(designPath, "model");
    try {
      chmodSync(privateDirectory, 0o000);
      const formal = new FormalModelRepositoryImplementation().findById(
        FormalModelIdentifier.of(ArtifactPath.of(formalPath)),
      );
      const design = new DesignModelRepositoryImplementation().findById(
        DesignModelIdentifier.of(ArtifactPath.of(designPath)),
      );
      expect(!formal.ok && formal.error.kind).toBe("io-failed");
      expect(!design.ok && design.error.kind).toBe("io-failed");
    } finally {
      chmodSync(privateDirectory, 0o700);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "validation materials repositories preserve unreadable artifact failures",
  () => {
    const directory = temporaryDirectory("artifact-materials-eacces-");
    const privateDirectory = join(directory, "private");
    mkdirSync(privateDirectory);
    const formalPath = join(privateDirectory, "deep-spec-analysis-formal-model.md");
    const designPath = join(privateDirectory, "deep-spec-analysis-functional-formal-model.md");
    writeFileSync(formalPath, "model");
    writeFileSync(designPath, "model");
    try {
      chmodSync(privateDirectory, 0o000);
      const formal = new IntermediateRepresentationValidationMaterialsRepositoryImplementation({
        schemaPath: join(directory, "schema.json"),
      }).findById(
        IntermediateRepresentationValidationMaterialsIdentifier.of(
          FormalModelIdentifier.of(ArtifactPath.of(formalPath)),
        ),
      );
      const design = new DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation({
        schemaPath: join(directory, "schema.json"),
      }).findById(
        DesignIntermediateRepresentationValidationMaterialsIdentifier.of(
          DesignModelIdentifier.of(ArtifactPath.of(designPath)),
        ),
      );
      expect(!formal.ok && formal.error.kind).toBe("io-failed");
      expect(!design.ok && design.error.kind).toBe("io-failed");
    } finally {
      chmodSync(privateDirectory, 0o700);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test("artifact stat reports an existing directory without an existsSync preflight", () => {
  const directory = temporaryDirectory("artifact-stat-");
  try {
    const stat = readArtifactStat(directory);
    expect(stat.ok).toBe(true);
    if (stat.ok) expect(stat.value.isDirectory()).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
