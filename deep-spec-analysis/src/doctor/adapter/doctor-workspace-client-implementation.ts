import type { Dirent, Stats } from "node:fs";
import { join } from "node:path";
import {
  ArtifactModifiedAt,
  CoverageAssessment,
  DesignArtifactReference,
  DesignArtifacts,
  DigestAnchor,
  FunctionalObservation,
  FunctionalUnitObservation,
  IntentLocation,
  StageScope,
  StageScopes,
  UnitCoverage,
  UnitCoverageProblem,
  VerificationObservation,
} from "@deep-spec-analysis/doctor-domain";
import type { DoctorWorkspaceClient } from "@deep-spec-analysis/doctor-usecase";
import {
  extractFences,
  parseYamlSubset,
  readArtifactBytes,
  readArtifactStat,
  readArtifactText,
  readDirectory,
} from "@deep-spec-analysis/kernel-adapter";
import { ArtifactPath, ContentHash, ErrorMessage, UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  canonicalStringify,
  err,
  isObject,
  type Json,
  ok,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import { readBackendEvidence } from "./backend-evidence-reader.ts";
import type { DoctorWorkspaceClientConfiguration } from "./doctor-workspace-client-configuration.ts";

function corrupt(path: string, cause: string): RepositoryError {
  return { kind: "corrupt", path, cause };
}

function optionalText(path: string): Result<string | null, RepositoryError> {
  const read = readArtifactText(path);
  if (read.ok) return read;
  return read.error.kind === "not-found" ? ok(null) : read;
}

function optionalBytes(path: string): Result<Uint8Array | null, RepositoryError> {
  const read = readArtifactBytes(path);
  if (read.ok) return read;
  return read.error.kind === "not-found" ? ok(null) : read;
}

function optionalStat(path: string): Result<Stats | null, RepositoryError> {
  const read = readArtifactStat(path);
  if (read.ok) return read;
  return read.error.kind === "not-found" ? ok(null) : read;
}

function optionalDirectory(path: string): Result<readonly Dirent[], RepositoryError> {
  const read = readDirectory(path);
  if (read.ok) return read;
  return read.error.kind === "not-found" ? ok([]) : read;
}

function modelDocument(text: string, path: string): Result<{ [key: string]: Json }, RepositoryError> {
  const fences = extractFences(text, "json");
  if (fences.length !== 1) return err(corrupt(path, "model must contain exactly one JSON fence"));
  let value: Json;
  try {
    value = JSON.parse(fences[0].body) as Json;
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return err(corrupt(path, cause.message));
  }
  return isObject(value) ? ok(value) : err(corrupt(path, "model must be a JSON object"));
}

function locationOf(space: string, intent: string, path: string): Result<IntentLocation, RepositoryError> {
  const parsedSpace = ArtifactPath.parse(space);
  const parsedIntent = ArtifactPath.parse(intent);
  if (!parsedSpace.ok) return err(corrupt(path, JSON.stringify(parsedSpace.error)));
  if (!parsedIntent.ok) return err(corrupt(path, JSON.stringify(parsedIntent.error)));
  return ok(IntentLocation.of(parsedSpace.value, parsedIntent.value));
}

// 不在だけを任意入力の欠如として扱う。走査・読取・文書不正は取得結果で伝える。
export class DoctorWorkspaceClientImplementation implements DoctorWorkspaceClient {
  readonly #projectDir: string;
  readonly #root: string;
  readonly #refcheckToolNames: DoctorWorkspaceClientConfiguration["refcheckToolNames"];

  constructor(config: DoctorWorkspaceClientConfiguration) {
    this.#projectDir = config.projectDir;
    this.#root = config.root;
    this.#refcheckToolNames = config.refcheckToolNames;
  }

  static readonly #FALLBACK_STAGE_SCOPES = StageScopes.of([StageScope.of("enterprise"), StageScope.of("feature")]);

  #scopesOfStage(phase: string, name: string): Result<StageScopes, RepositoryError> {
    const path = join(this.#root, "aidlc-common", "stages", phase, name);
    const read = optionalText(path);
    if (!read.ok) return read;
    if (read.value === null) return ok(DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES);
    const frontmatter = read.value.split("\n---")[0];
    const lines = frontmatter.split("\n");
    const indexes = lines.flatMap((line, index) => (/^scopes\s*:/.test(line) ? [index] : []));
    if (indexes.length === 0) return ok(DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES);
    if (indexes.length !== 1) return err(corrupt(path, "stage scopes are duplicated"));
    const start = indexes[0];
    const section = [lines[start]];
    for (let index = start + 1; index < lines.length && /^(?:\s|#|$)/.test(lines[index]); index++)
      section.push(lines[index]);
    const parsedYaml = parseYamlSubset(section.join("\n"));
    if (parsedYaml.error !== undefined) return err(corrupt(path, parsedYaml.error));
    if (parsedYaml.value === undefined || !isObject(parsedYaml.value) || !Array.isArray(parsedYaml.value.scopes))
      return err(corrupt(path, "stage scopes must be a list"));
    const values: StageScope[] = [];
    for (const item of parsedYaml.value.scopes) {
      if (typeof item !== "string") return err(corrupt(path, "stage scope must be a string"));
      const scope = StageScope.parse(item);
      if (!scope.ok) return err(corrupt(path, JSON.stringify(scope.error)));
      values.push(scope.value);
    }
    const parsed = StageScopes.parse(values);
    return parsed.ok ? parsed : err(corrupt(path, JSON.stringify(parsed.error)));
  }

  #records(): Result<readonly { path: string; location: IntentLocation }[], RepositoryError> {
    const spacesPath = join(this.#projectDir, "aidlc", "spaces");
    const spaces = optionalDirectory(spacesPath);
    if (!spaces.ok) return spaces;
    const records: { path: string; location: IntentLocation }[] = [];
    for (const space of spaces.value) {
      if (!space.isDirectory()) continue;
      const intents = optionalDirectory(join(spacesPath, space.name, "intents"));
      if (!intents.ok) return intents;
      for (const intent of intents.value) {
        if (!intent.isDirectory() || intent.name.startsWith(".")) continue;
        const path = join(spacesPath, space.name, "intents", intent.name);
        const location = locationOf(space.name, intent.name, path);
        if (!location.ok) return location;
        records.push({ path, location: location.value });
      }
    }
    return ok(records);
  }

  #scopeOf(record: string): Result<StageScope, RepositoryError> {
    const path = join(record, "aidlc-state.md");
    const state = readArtifactText(path);
    if (!state.ok) return state;
    const scope = state.value.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1];
    if (scope === undefined) return err(corrupt(path, "intent scope is missing"));
    const parsed = StageScope.parse(scope);
    return parsed.ok ? parsed : err(corrupt(path, JSON.stringify(parsed.error)));
  }

  verificationCoverage(): Result<CoverageAssessment, RepositoryError> {
    const scopes = this.#scopesOfStage("inception", "deep-spec-analysis-verify.md");
    if (!scopes.ok) return scopes;
    const records = this.#records();
    if (!records.ok) return records;
    const observations: VerificationObservation[] = [];
    for (const { path: record, location } of records.value) {
      const scope = this.#scopeOf(record);
      if (!scope.ok) return scope;
      if (!scopes.value.include(scope.value)) continue;
      const requirementsPath = join(record, "inception", "requirements-analysis", "requirements.md");
      const requirements = optionalBytes(requirementsPath);
      if (!requirements.ok) return requirements;
      if (requirements.value === null) continue;
      const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
      const model = optionalText(modelPath);
      if (!model.ok) return model;
      let anchor: DigestAnchor | null = null;
      let hasFindings = false;
      if (model.value !== null) {
        const document = modelDocument(model.value, modelPath);
        if (!document.ok) return document;
        if (document.value.sourceDigest !== undefined) {
          if (typeof document.value.sourceDigest !== "string")
            return err(corrupt(modelPath, "sourceDigest must be a string"));
          const digest = ContentHash.parse(document.value.sourceDigest);
          if (!digest.ok) return err(corrupt(modelPath, JSON.stringify(digest.error)));
          anchor = DigestAnchor.of(digest.value, ContentHash.ofBytes(requirements.value));
        }
        const hash = ContentHash.ofText(canonicalStringify(document.value));
        const evidence = readBackendEvidence(
          join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify"),
        );
        if (!evidence.ok) return evidence;
        hasFindings = evidence.value.some((report) => report.countsFor(hash));
      }
      observations.push(VerificationObservation.of({ location, hasModel: model.value !== null, hasFindings, anchor }));
    }
    const parsed = CoverageAssessment.parse(observations, scopes.value);
    return parsed.ok ? parsed : err(corrupt(join(this.#projectDir, "aidlc"), JSON.stringify(parsed.error)));
  }

  designArtifacts(): Result<DesignArtifacts, RepositoryError> {
    const records = this.#records();
    if (!records.ok) return records;
    const values: DesignArtifactReference[] = [];
    for (const { path: record, location } of records.value) {
      const append = (tool: string, path: string, label: string): Result<void, RepositoryError> => {
        const present = optionalStat(path);
        if (!present.ok) return present;
        if (present.value === null) return ok(undefined);
        const parsedPath = ArtifactPath.parse(path);
        if (!parsedPath.ok) return err(corrupt(path, JSON.stringify(parsedPath.error)));
        values.push(
          DesignArtifactReference.of({
            location,
            tool: ArtifactPath.of(tool),
            artifactPath: parsedPath.value,
            relativePath: ArtifactPath.of(label),
          }),
        );
        return ok(undefined);
      };
      for (const [tool, label] of [
        [this.#refcheckToolNames.domain, "inception/domain-design/components.md"],
        [this.#refcheckToolNames.contract, "inception/contract-design/contract-summary.md"],
      ]) {
        const appended = append(tool, join(record, label), label);
        if (!appended.ok) return appended;
      }
      const construction = join(record, "construction");
      const units = optionalDirectory(construction);
      if (!units.ok) return units;
      for (const unit of [...units.value]
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const directory = join(construction, unit.name, "functional-design");
        for (const name of ["entities.md", "rules.md", "functional-spec.md"]) {
          const path = join(directory, name);
          const found = optionalStat(path);
          if (!found.ok) return found;
          if (found.value === null) continue;
          const appended = append(
            this.#refcheckToolNames.functional,
            path,
            `construction/${unit.name}/functional-design`,
          );
          if (!appended.ok) return appended;
          break;
        }
      }
    }
    const parsed = DesignArtifacts.parse(values);
    return parsed.ok ? parsed : err(corrupt(join(this.#projectDir, "aidlc"), JSON.stringify(parsed.error)));
  }

  functionalCoverage(): Result<UnitCoverage, RepositoryError> {
    const scopes = this.#scopesOfStage("construction", "deep-spec-analysis-functional-verify.md");
    if (!scopes.ok) return scopes;
    const records = this.#records();
    if (!records.ok) return records;
    const observations: FunctionalObservation[] = [];
    const invalidUnits: UnitCoverageProblem[] = [];
    for (const { path: record, location } of records.value) {
      const scope = this.#scopeOf(record);
      if (!scope.ok) return scope;
      if (!scopes.value.include(scope.value)) continue;
      const construction = join(record, "construction");
      const listed = optionalDirectory(construction);
      if (!listed.ok) return listed;
      const units: FunctionalUnitObservation[] = [];
      for (const unit of [...listed.value]
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const directory = join(construction, unit.name, "functional-design");
        const present = optionalStat(directory);
        if (!present.ok) return present;
        if (present.value === null) continue;
        if (!present.value.isDirectory()) return err(corrupt(directory, "functional-design must be a directory"));
        const name = UnitName.parse(unit.name);
        if (!name.ok) {
          const message = ErrorMessage.parse(JSON.stringify(name.error));
          if (!message.ok) return err(corrupt(directory, JSON.stringify(message.error)));
          invalidUnits.push(UnitCoverageProblem.invalid(location, message.value));
          continue;
        }
        let newest = 0;
        for (const filename of ["entities.md", "rules.md", "functional-spec.md"]) {
          const modified = optionalStat(join(directory, filename));
          if (!modified.ok) return modified;
          if (modified.value !== null && !modified.value.isFile())
            return err(corrupt(join(directory, filename), "functional-design artifact must be a file"));
          if (modified.value !== null) newest = Math.max(newest, modified.value.mtimeMs);
        }
        const modified = ArtifactModifiedAt.parse(newest);
        if (!modified.ok) return err(corrupt(directory, JSON.stringify(modified.error)));
        units.push(FunctionalUnitObservation.of(name.value, modified.value));
      }
      if (units.length === 0) continue;
      const stage = join(construction, "deep-spec-analysis-functional-verify");
      const modelPath = join(stage, "deep-spec-analysis-functional-formal-model.md");
      const model = optionalText(modelPath);
      if (!model.ok) return model;
      const modelStat = optionalStat(modelPath);
      if (!modelStat.ok) return modelStat;
      const modelUnits: UnitName[] = [];
      const completedUnits: UnitName[] = [];
      let hasFindings = false;
      if (model.value !== null) {
        const document = modelDocument(model.value, modelPath);
        if (!document.ok) return document;
        if (!Array.isArray(document.value.units)) return err(corrupt(modelPath, "design model units must be an array"));
        for (const unit of document.value.units) {
          if (!isObject(unit) || typeof unit.unit !== "string")
            return err(corrupt(modelPath, "design model unit name is missing"));
          const name = UnitName.parse(unit.unit);
          if (!name.ok) return err(corrupt(modelPath, JSON.stringify(name.error)));
          modelUnits.push(name.value);
        }
        const hash = ContentHash.ofText(canonicalStringify(document.value));
        const evidence = readBackendEvidence(join(stage, "deep-spec-design-verify"));
        if (!evidence.ok) return evidence;
        hasFindings = evidence.value.some((report) => report.countsFor(hash));
        for (const report of evidence.value) completedUnits.push(...report.completedUnitsFor(hash));
      }
      const requirementsPath = join(
        record,
        "inception",
        "deep-spec-analysis-verify",
        "deep-spec-analysis-formal-model.md",
      );
      const requirementsStat = optionalStat(requirementsPath);
      if (!requirementsStat.ok) return requirementsStat;
      const modified = modelStat.value === null ? ok(null) : ArtifactModifiedAt.parse(modelStat.value.mtimeMs);
      if (!modified.ok) return err(corrupt(modelPath, JSON.stringify(modified.error)));
      const requirementsModified =
        requirementsStat.value === null ? ok(null) : ArtifactModifiedAt.parse(requirementsStat.value.mtimeMs);
      if (!requirementsModified.ok) return err(corrupt(requirementsPath, JSON.stringify(requirementsModified.error)));
      const observation = FunctionalObservation.parse({
        location,
        units,
        modelModifiedAt: modified.value,
        modelUnits,
        completedUnits,
        hasFindings,
        requirementsModelModifiedAt: requirementsModified.value,
      });
      if (!observation.ok) return err(corrupt(record, JSON.stringify(observation.error)));
      observations.push(observation.value);
    }
    const parsed = UnitCoverage.parse(observations, scopes.value, invalidUnits);
    return parsed.ok ? parsed : err(corrupt(join(this.#projectDir, "aidlc"), JSON.stringify(parsed.error)));
  }
}
