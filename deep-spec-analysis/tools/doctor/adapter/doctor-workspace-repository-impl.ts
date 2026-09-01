import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ContentHash } from "../../kernel/domain/index.ts";
import type {
  DesignArtifactRef,
  DoctorWorkspaceRepository,
  FunctionalTarget,
  FunctionalUnitFacts,
  VerificationTarget,
} from "../usecase/index.ts";
import type { DoctorWorkspaceRepositoryConfig } from "./doctor-workspace-repository-config.ts";

// aidlc ワークスペース走査の実 Gateway。旧 doctor の scopesOfStage /
// scanVerificationCoverage / scanDesignDebt / scanFunctionalCoverage の
// 読取部からの逐語移植——走査順（spaces/intents は readdir の自然順、unit は
// 昇順）、try/catch の黙殺範囲、anchor がある時だけ requirements をハッシュ
// する遅延、fence 抽出の正規表現はすべて凍結挙動。
export class DoctorWorkspaceRepositoryImpl implements DoctorWorkspaceRepository {
  readonly #projectDir: string;
  readonly #root: string;

  constructor(config: DoctorWorkspaceRepositoryConfig) {
    this.#projectDir = config.projectDir;
    this.#root = config.root;
  }

  static readonly #FALLBACK_STAGE_SCOPES = ["enterprise", "feature"];

  #scopesOfStage(...stagePath: string[]): string[] {
    const stageFile = join(this.#root, "aidlc-common", "stages", ...stagePath);
    try {
      const frontmatter = readFileSync(stageFile, "utf-8").split("\n---")[0];
      const m = frontmatter.match(/^scopes:\n((?:\s+- .+\n)+)/m);
      const items = m?.[1]?.match(/- (\S+)/g) ?? null;
      if (items) return items.map((s) => s.slice(2));
    } catch {
      // fall through to the authored default
    }
    return DoctorWorkspaceRepositoryImpl.#FALLBACK_STAGE_SCOPES;
  }

  verificationScopes(): readonly string[] {
    return this.#scopesOfStage("inception", "deep-spec-analysis-verify.md");
  }

  functionalScopes(): readonly string[] {
    return this.#scopesOfStage("construction", "deep-spec-analysis-functional-verify.md");
  }

  #spaces(): string[] {
    try {
      return readdirSync(join(this.#projectDir, "aidlc", "spaces"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  #intents(space: string): string[] {
    try {
      return readdirSync(join(this.#projectDir, "aidlc", "spaces", space, "intents"), { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  #record(space: string, intent: string): string {
    return join(this.#projectDir, "aidlc", "spaces", space, "intents", intent);
  }

  #scopeOf(record: string): string | null {
    let state = "";
    try {
      state = readFileSync(join(record, "aidlc-state.md"), "utf-8");
    } catch {
      return null;
    }
    return state.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1] ?? null;
  }

  verificationTargets(scopes: readonly string[]): readonly VerificationTarget[] {
    const out: VerificationTarget[] = [];
    const inScope = new Set(scopes);
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope || !inScope.has(scope)) continue;
        const requirements = join(record, "inception", "requirements-analysis", "requirements.md");
        if (!existsSync(requirements)) continue;
        const model = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        const verifyDir = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify");
        let hasFindings = false;
        try {
          hasFindings = readdirSync(verifyDir).some((f) => f.endsWith(".json"));
        } catch {
          hasFindings = false;
        }
        const hasModel = existsSync(model);
        if (!hasModel || !hasFindings) {
          out.push({ space, intent, hasModel, hasFindings, anchor: null, sourceNewerThanModel: false });
          continue;
        }
        // Content-based staleness の材料: モデルが sourceDigest を刻んでいれば
        // その anchor と現在の requirements.md バイトの実測 sha256 の対を渡す
        //（mtime の嘘に騙されない）。anchor 以前のモデルは mtime 比較のみ。
        const anchored = readFileSync(model, "utf-8")
          .match(/```json\n([\s\S]*?)```/)?.[1]
          ?.match(/"sourceDigest"\s*:\s*"([0-9a-f]{64})"/)?.[1];
        out.push({
          space,
          intent,
          hasModel,
          hasFindings,
          anchor: anchored
            ? { expected: ContentHash.reconstitute(anchored), actual: ContentHash.ofBytes(readFileSync(requirements)) }
            : null,
          sourceNewerThanModel: anchored ? false : statSync(requirements).mtimeMs > statSync(model).mtimeMs,
        });
      }
    }
    return out;
  }

  designArtifacts(): readonly DesignArtifactRef[] {
    const out: DesignArtifactRef[] = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const ref = (tool: string, artifactPath: string, label: string): void => {
          if (!existsSync(artifactPath)) return;
          out.push({ space, intent, tool, artifactPath, label });
        };
        ref("aidlc-sensor-deep-spec-refcheck-domain.ts", join(record, "inception", "domain-design", "components.md"),
          "inception/domain-design/components.md");
        ref("aidlc-sensor-deep-spec-refcheck-contract.ts", join(record, "inception", "contract-design", "contract-summary.md"),
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
            ref("aidlc-sensor-deep-spec-refcheck-functional.ts", trigger, `construction/${unit}/functional-design`);
          }
        }
      }
    }
    return out;
  }

  functionalTargets(scopes: readonly string[]): readonly FunctionalTarget[] {
    const out: FunctionalTarget[] = [];
    const inScope = new Set(scopes);
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope || !inScope.has(scope)) continue;
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
        let modelUnits: string[] = [];
        let modelMtime = 0;
        // Per-unit completion evidence: 実 backend 文書（cross-check でも
        // unavailable でもない）の checked[] に載った unit だけが完了。
        const completedUnits = new Set<string>();
        let hasFindings = false;
        if (existsSync(modelPath)) {
          try {
            modelMtime = statSync(modelPath).mtimeMs;
            const fence = readFileSync(modelPath, "utf-8").match(/```json\n([\s\S]*?)```/);
            const ir = fence ? JSON.parse(fence[1] ?? "{}") : {};
            for (const u of Array.isArray(ir.units) ? ir.units : []) {
              if (u && typeof u.unit === "string") modelUnits.push(u.unit);
            }
          } catch {
            modelUnits = [];
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
        const units: FunctionalUnitFacts[] = unitDirs.map((unit) => {
          const fdDir = join(constructionDir, unit, "functional-design");
          let newest = 0;
          for (const f of ["entities.md", "rules.md", "functional-spec.md"]) {
            const p = join(fdDir, f);
            if (existsSync(p)) newest = Math.max(newest, statSync(p).mtimeMs);
          }
          return { name: unit, newestArtifactMtime: newest };
        });
        const reqModel = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        out.push({
          space,
          intent,
          units,
          modelMtime,
          modelUnits,
          completedUnits: [...completedUnits],
          hasFindings,
          requirementsModelMtime: existsSync(reqModel) ? statSync(reqModel).mtimeMs : null,
        });
      }
    }
    return out;
  }
}
