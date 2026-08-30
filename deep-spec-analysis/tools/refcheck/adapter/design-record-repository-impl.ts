// DesignRecordRepository の実 Gateway 実装。
// record ルートの発見・関連成果物の読取・解析（形式知識）をここに集約し、
// 型付きの DesignRecord を再構成する。取得規則は旧 entry 群の凍結挙動：
//   - requirements.md は rules が extracted のときだけ読む
//   - 兄弟ユニットは components カタログが解析できたときだけ読む
//   - 自ユニットの entities.md は兄弟 inputs に重複記録しない
// 対象が読めないときは not-found（呼び手が not-applicable を選ぶ）。

import { basename, dirname, join } from "node:path";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { requirementIds, sha256 } from "../../kernel/domain/index.ts";
import {
  findRecordRoot,
  listSubdirectories,
  readIfExists,
  relArtifact,
} from "../../kernel/adapter/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import {
  type DesignRecordId,
  DesignRecord,
  type DesignRecordSeed,
  type InputAnchor,
} from "../domain/index.ts";
import type { DesignRecordRepository } from "../usecase/index.ts";
import { parseComponentCatalog } from "./component-catalog-parser.ts";
import { assessSpecBlocks, parseContractsTable, parseDeclaredUnits } from "./contract-summary-parser.ts";
import {
  buildSiblingUnitEntities,
  parseDomainEntitiesDocument,
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
  parseRulesDocument,
} from "./functional-design-parser.ts";

export class DesignRecordRepositoryImpl implements DesignRecordRepository {
  findById(id: DesignRecordId): Result<DesignRecord, RepositoryError> {
    const artifactPath = id.artifactPath().value();
    const md = readIfExists(artifactPath);
    if (md === null) {
      return err({ kind: "not-found", path: artifactPath });
    }
    const targetBase = basename(artifactPath);
    const fdDir = dirname(artifactPath);
    const isFunctional = basename(fdDir) === "functional-design";
    const recordRoot = findRecordRoot(isFunctional ? fdDir : dirname(artifactPath));
    const rel = (p: string): string => relArtifact(recordRoot, p);
    const input = (p: string, text: string): InputAnchor => ({ artifact: rel(p), sha256: sha256(text) });

    const seed: DesignRecordSeed = {
      id,
      target: input(artifactPath, md),
      componentCatalog: targetBase === "components.md" ? parseComponentCatalog(md) : null,
      contractsTable: targetBase === "contract-summary.md" ? parseContractsTable(md) : null,
      specBlocks: targetBase === "contract-summary.md" ? assessSpecBlocks(md) : null,
      declaredUnits: targetBase === "contract-summary.md" ? this.#declaredUnits(recordRoot) : null,
      functional: isFunctional ? this.#functional(recordRoot, fdDir) : null,
    };
    return ok(DesignRecord.reconstitute(seed));
  }

  #declaredUnits(recordRoot: string | null): NonNullable<DesignRecordSeed["declaredUnits"]> {
    const depPath = recordRoot === null ? null : join(recordRoot, "inception", "units-generation", "unit-of-work-dependency.md");
    const depMd = depPath === null ? null : readIfExists(depPath);
    if (depPath === null || depMd === null) {
      return { artifactName: depPath === null ? "unit-of-work-dependency.md" : relArtifact(recordRoot, depPath), document: null };
    }
    return {
      artifactName: relArtifact(recordRoot, depPath),
      document: {
        input: { artifact: relArtifact(recordRoot, depPath), sha256: sha256(depMd) },
        outcome: parseDeclaredUnits(depMd),
      },
    };
  }

  #functional(recordRoot: string | null, fdDir: string): NonNullable<DesignRecordSeed["functional"]> {
    const rel = (p: string): string => relArtifact(recordRoot, p);
    const load = <T>(path: string, parse: (text: string) => T): { input: InputAnchor; outcome: T } | null => {
      const text = readIfExists(path);
      if (text === null) return null;
      return { input: { artifact: rel(path), sha256: sha256(text) }, outcome: parse(text) };
    };

    const unitDir = dirname(fdDir);
    const unit = recordRoot !== null && basename(unitDir) !== "construction" && unitDir !== recordRoot ? basename(unitDir) : undefined;

    const entitiesPath = join(fdDir, "entities.md");
    const entities = load(entitiesPath, (t) => parseEntitiesDocument(t));
    const rulesPath = join(fdDir, "rules.md");
    const rules = load(rulesPath, (t) => parseRulesDocument(t));
    const specPath = join(fdDir, "functional-spec.md");
    const spec = load(specPath, (t) => parseFunctionalSpecDocument(t));

    // requirements.md は rules が使えるときだけ読む（凍結された取得条件）。
    const reqPath = recordRoot === null ? null : join(recordRoot, "inception", "requirements-analysis", "requirements.md");
    const requirements = rules !== null && rules.outcome.kind === "extracted" && reqPath !== null
      ? load(reqPath, (t) => requirementIds(t))
      : null;

    const componentsPath = recordRoot === null ? null : join(recordRoot, "inception", "domain-design", "components.md");
    const components = componentsPath === null ? null : load(componentsPath, (t) => parseDomainEntitiesDocument(t));

    // 兄弟ユニットは components カタログが解析できたときだけ読む。
    const siblingTexts: { unit: string; path: string; text: string }[] = [];
    if (components !== null && components.outcome.kind === "extracted" && recordRoot !== null) {
      const constructionDir = join(recordRoot, "construction");
      for (const u of listSubdirectories(constructionDir)) {
        const p = join(constructionDir, u, "functional-design", "entities.md");
        const text = readIfExists(p);
        if (text !== null) siblingTexts.push({ unit: u, path: p, text });
      }
    }

    return {
      unit,
      entitiesArtifact: rel(entitiesPath),
      entities,
      rulesArtifact: rel(rulesPath),
      rules,
      specArtifact: rel(specPath),
      spec,
      requirements,
      componentsArtifact: componentsPath === null ? "components.md" : rel(componentsPath),
      components,
      siblingUnits: buildSiblingUnitEntities(siblingTexts),
      siblingInputs: siblingTexts
        .filter((s) => s.path !== entitiesPath)
        .map((s) => ({ artifact: rel(s.path), sha256: sha256(s.text) })),
    };
  }
}
