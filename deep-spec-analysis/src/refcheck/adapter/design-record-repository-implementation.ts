import {
  findRecordRoot,
  parseRequirementIdentifiers,
  readArtifactBytes,
  readArtifactText,
  readDirectory,
  relArtifact,
  writeFileAtomically,
} from "@deep-spec-analysis/kernel-adapter";

// DesignRecordRepository の実 Gateway 実装。
// record ルートの発見・関連成果物の読取・解析（形式知識）をここに集約し、
// 型付きの DesignRecord を再構成する。取得規則は旧 entry 群の凍結挙動：
//   - requirements.md は rules が extracted のときだけ読む
//   - 兄弟ユニットは components カタログが解析できたときだけ読む
//   - 自ユニットの entities.md は兄弟 inputs に重複記録しない
// 対象の不在だけを not-found とし、読取障害は RepositoryError で呼び手へ返す。

import { basename, dirname, join } from "node:path";
import { ArtifactPath, ContentHash } from "@deep-spec-analysis/kernel-domain";
import { err, ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";

import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import {
  DesignRecord,
  type DesignRecordIdentifier,
  InputAnchor,
  InputAnchors,
  UnitName,
} from "@deep-spec-analysis/refcheck-domain";
import type { DesignRecordRepository } from "@deep-spec-analysis/refcheck-usecase";
import { parseComponentCatalog } from "./component-catalog-parser.ts";
import { assessSpecBlocks, parseContractsTable, parseDeclaredUnits } from "./contract-summary-parser.ts";
import {
  buildSiblingUnitEntities,
  parseDomainEntitiesDocument,
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
  parseRulesDocument,
} from "./functional-design-parser.ts";

export class DesignRecordRepositoryImplementation implements DesignRecordRepository {
  findById(id: DesignRecordIdentifier): Result<DesignRecord, RepositoryError> {
    const artifactPath = id.artifactPath().asString();
    // 錨成果物は生バイト列で一度だけ読む（UTF-8 復号は解析・ダイジェスト専用）。
    const source = readArtifactBytes(artifactPath);
    if (!source.ok) return source;
    const sourceBytes = source.value;
    const md = Buffer.from(sourceBytes).toString("utf-8");
    const targetBase = basename(artifactPath);
    const fdDir = dirname(artifactPath);
    const isFunctional = basename(fdDir) === "functional-design";
    const foundRecordRoot = findRecordRoot(isFunctional ? fdDir : dirname(artifactPath));
    if (!foundRecordRoot.ok) return err(foundRecordRoot.error);
    const recordRoot = foundRecordRoot.value;
    const rel = (p: string): string => relArtifact(recordRoot, p);
    const input = (p: string, text: string): InputAnchor =>
      InputAnchor.of({ artifact: rel(p), sha256: ContentHash.ofText(text) });

    let contractSummary: NonNullable<Parameters<typeof DesignRecord.of>[0]["contractSummary"]> | null = null;
    if (targetBase === "contract-summary.md") {
      const specBlocks = assessSpecBlocks(md);
      if (!specBlocks.ok) return err({ kind: "corrupt", path: artifactPath, cause: JSON.stringify(specBlocks.error) });
      const declaredUnits = this.#declaredUnits(recordRoot);
      if (!declaredUnits.ok) return declaredUnits;
      contractSummary = {
        contractsTable: parseContractsTable(md),
        specBlocks: specBlocks.value,
        declaredUnits: declaredUnits.value,
      };
    }
    const functional = isFunctional ? this.#functional(recordRoot, fdDir) : ok(null);
    if (!functional.ok) return functional;
    const seed: Parameters<typeof DesignRecord.of>[0] = {
      id,
      target: input(artifactPath, md),
      sourceDocument: sourceBytes,
      componentCatalog: targetBase === "components.md" ? parseComponentCatalog(md) : null,
      contractSummary,
      functional: functional.value,
    };
    return ok(DesignRecord.of(seed));
  }

  // 往復則: findById が読んだ錨成果物の原文をバイト逐語で書き戻す。
  store(record: DesignRecord): Result<void, RepositoryError> {
    const path = record.id().artifactPath().asString();
    const bytes = record.sourceDocument();
    try {
      writeFileAtomically(path, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }

  #declaredUnits(
    recordRoot: string | null,
  ): Result<NonNullable<Parameters<typeof DesignRecord.of>[0]["contractSummary"]>["declaredUnits"], RepositoryError> {
    const depPath =
      recordRoot === null ? null : join(recordRoot, "inception", "units-generation", "unit-of-work-dependency.md");
    if (depPath === null) {
      return ok({
        artifactName: ArtifactPath.of("unit-of-work-dependency.md"),
        document: null,
      });
    }
    const depMd = readArtifactText(depPath);
    if (!depMd.ok) {
      if (depMd.error.kind === "not-found")
        return ok({
          artifactName: ArtifactPath.of(relArtifact(recordRoot, depPath)),
          document: null,
        });
      return depMd;
    }
    return ok({
      artifactName: ArtifactPath.of(relArtifact(recordRoot, depPath)),
      document: {
        input: InputAnchor.of({ artifact: relArtifact(recordRoot, depPath), sha256: ContentHash.ofText(depMd.value) }),
        outcome: parseDeclaredUnits(depMd.value),
      },
    });
  }

  #functional(
    recordRoot: string | null,
    fdDir: string,
  ): Result<NonNullable<Parameters<typeof DesignRecord.of>[0]["functional"]>, RepositoryError> {
    const rel = (p: string): string => relArtifact(recordRoot, p);
    const load = <T>(
      path: string,
      parse: (text: string) => T,
    ): Result<{ input: InputAnchor; outcome: T } | null, RepositoryError> => {
      const text = readArtifactText(path);
      if (!text.ok) return text.error.kind === "not-found" ? ok(null) : text;
      return ok({
        input: InputAnchor.of({ artifact: rel(path), sha256: ContentHash.ofText(text.value) }),
        outcome: parse(text.value),
      });
    };

    const unitDir = dirname(fdDir);
    const unit =
      recordRoot !== null && basename(unitDir) !== "construction" && unitDir !== recordRoot
        ? basename(unitDir)
        : undefined;
    const parsedUnit: Result<UnitName | undefined, ParseError> =
      unit === undefined ? ok(undefined) : UnitName.parse(unit);
    if (!parsedUnit.ok) return err({ kind: "corrupt", path: fdDir, cause: JSON.stringify(parsedUnit.error) });

    const entitiesPath = join(fdDir, "entities.md");
    const entitiesResult = load(entitiesPath, (t) => parseEntitiesDocument(t));
    if (!entitiesResult.ok) return entitiesResult;
    const entities = entitiesResult.value;
    const rulesPath = join(fdDir, "rules.md");
    const rulesResult = load(rulesPath, (t) => parseRulesDocument(t));
    if (!rulesResult.ok) return rulesResult;
    const rules = rulesResult.value;
    const specPath = join(fdDir, "functional-spec.md");
    const specResult = load(specPath, (t) => parseFunctionalSpecDocument(t));
    if (!specResult.ok) return specResult;
    const spec = specResult.value;

    // requirements.md は rules が使えるときだけ読む（凍結された取得条件）。
    const reqPath =
      recordRoot === null ? null : join(recordRoot, "inception", "requirements-analysis", "requirements.md");
    let requirements: NonNullable<Parameters<typeof DesignRecord.of>[0]["functional"]>["requirements"] = null;
    if (rules?.outcome.isExtracted() && reqPath !== null) {
      const text = readArtifactText(reqPath);
      if (!text.ok) {
        if (text.error.kind !== "not-found") return text;
      } else {
        const parsed = parseRequirementIdentifiers(text.value);
        if (!parsed.ok) return err({ kind: "corrupt", path: reqPath, cause: JSON.stringify(parsed.error) });
        requirements = {
          input: InputAnchor.of({ artifact: rel(reqPath), sha256: ContentHash.ofText(text.value) }),
          outcome: parsed.value,
        };
      }
    }

    const componentsPath = recordRoot === null ? null : join(recordRoot, "inception", "domain-design", "components.md");
    const componentsResult =
      componentsPath === null ? ok(null) : load(componentsPath, (t) => parseDomainEntitiesDocument(t));
    if (!componentsResult.ok) return componentsResult;
    const components = componentsResult.value;

    // 兄弟ユニットは components カタログが解析できたときだけ読む。
    const siblingTexts: { unit: string; path: string; text: string }[] = [];
    if (components?.outcome.isExtracted() && recordRoot !== null) {
      const constructionDir = join(recordRoot, "construction");
      const construction = readDirectory(constructionDir);
      if (!construction.ok) {
        if (construction.error.kind !== "not-found") return construction;
      } else
        for (const u of construction.value
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()) {
          const p = join(constructionDir, u, "functional-design", "entities.md");
          const text = readArtifactText(p);
          if (!text.ok) {
            if (text.error.kind !== "not-found") return text;
          } else siblingTexts.push({ unit: u, path: p, text: text.value });
        }
    }

    const siblingInputs = InputAnchors.parse(
      siblingTexts
        .filter((s) => s.path !== entitiesPath)
        .map((s) => InputAnchor.of({ artifact: rel(s.path), sha256: ContentHash.ofText(s.text) })),
    );
    if (!siblingInputs.ok) return err({ kind: "corrupt", path: fdDir, cause: JSON.stringify(siblingInputs.error) });
    return ok({
      unit: parsedUnit.value,
      entitiesArtifact: ArtifactPath.of(rel(entitiesPath)),
      entities,
      rulesArtifact: ArtifactPath.of(rel(rulesPath)),
      rules,
      specArtifact: ArtifactPath.of(rel(specPath)),
      spec,
      requirements,
      componentsArtifact: ArtifactPath.of(componentsPath === null ? "components.md" : rel(componentsPath)),
      components,
      siblingUnits: buildSiblingUnitEntities(siblingTexts),
      siblingInputs: siblingInputs.value,
    });
  }
}
