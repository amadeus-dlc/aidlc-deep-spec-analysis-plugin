import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
  VerificationObservation,
} from "@deep-spec/doctor-domain";
import type { DoctorWorkspaceClient } from "@deep-spec/doctor-usecase";
import { ArtifactPath, ContentHash, UnitName } from "@deep-spec/kernel-domain";
import type { DoctorWorkspaceClientConfiguration } from "./doctor-workspace-client-configuration.ts";

// aidlc ワークスペース走査の実 Gateway。旧 doctor の scopesOfStage /
// scanVerificationCoverage / scanDesignDebt / scanFunctionalCoverage の
// 読取部からの逐語移植——走査順（spaces/intents は readdir の自然順、unit は
// 昇順）、try/catch の黙殺範囲、anchor がある時だけ requirements をハッシュ
// する遅延、fence 抽出の正規表現はすべて凍結挙動。
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

  #scopesOfStage(...stagePath: string[]): StageScopes {
    const stageFile = join(this.#root, "aidlc-common", "stages", ...stagePath);
    let items: readonly string[] | null = null;
    try {
      const frontmatter = readFileSync(stageFile, "utf-8").split("\n---")[0];
      const m = frontmatter.match(/^scopes:\n((?:\s+- .+\n)+)/m);
      items = m?.[1]?.match(/- (\S+)/g)?.map((item) => item.slice(2)) ?? null;
    } catch {
      // fall through to the authored default
    }
    if (items === null) return DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES;
    const scopes: StageScope[] = [];
    for (const item of items) {
      const parsed = StageScope.parse(item);
      if (!parsed.ok) return DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES;
      scopes.push(parsed.value);
    }
    const parsed = StageScopes.parse(scopes);
    return parsed.ok ? parsed.value : DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES;
  }

  #verificationScopes(): StageScopes {
    return this.#scopesOfStage("inception", "deep-spec-analysis-verify.md");
  }

  #functionalScopes(): StageScopes {
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

  verificationCoverage(): CoverageAssessment {
    const scopes = this.#verificationScopes();
    const out: VerificationObservation[] = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope) continue;
        const parsedScope = StageScope.parse(scope);
        if (!parsedScope.ok || !scopes.includes(parsedScope.value)) continue;
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
          out.push(
            VerificationObservation.of({
              location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
              hasModel,
              hasFindings,
              anchor: null,
            }),
          );
          continue;
        }
        // Content-based staleness の材料: モデルが sourceDigest を刻んでいれば
        // その anchor と現在の requirements.md バイトの実測 sha256 の対を渡す
        //（mtime の嘘に騙されない）。anchor を持たないモデルは対なし＝domain が
        // 無条件 stale と判じる（後方互換の mtime 比較は裁定で削除）。
        const anchored = readFileSync(model, "utf-8")
          .match(/```json\n([\s\S]*?)```/)?.[1]
          ?.match(/"sourceDigest"\s*:\s*"([0-9a-f]{64})"/)?.[1];
        out.push(
          VerificationObservation.of({
            location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
            hasModel,
            hasFindings,
            anchor: anchored
              ? DigestAnchor.of(ContentHash.of(anchored), ContentHash.ofBytes(readFileSync(requirements)))
              : null,
          }),
        );
      }
    }
    return CoverageAssessment.of(out, scopes);
  }

  designArtifacts(): DesignArtifacts {
    const out: DesignArtifactReference[] = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const ref = (tool: string, artifactPath: string, label: string): void => {
          if (!existsSync(artifactPath)) return;
          out.push(
            DesignArtifactReference.of({
              location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
              tool: ArtifactPath.of(tool),
              artifactPath: ArtifactPath.of(artifactPath),
              relativePath: ArtifactPath.of(label),
            }),
          );
        };
        ref(
          this.#refcheckToolNames.domain,
          join(record, "inception", "domain-design", "components.md"),
          "inception/domain-design/components.md",
        );
        ref(
          this.#refcheckToolNames.contract,
          join(record, "inception", "contract-design", "contract-summary.md"),
          "inception/contract-design/contract-summary.md",
        );
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
            ref(this.#refcheckToolNames.functional, trigger, `construction/${unit}/functional-design`);
          }
        }
      }
    }
    return DesignArtifacts.of(out);
  }

  functionalCoverage(): UnitCoverage {
    const scopes = this.#functionalScopes();
    const out: FunctionalObservation[] = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope) continue;
        const parsedScope = StageScope.parse(scope);
        if (!parsedScope.ok || !scopes.includes(parsedScope.value)) continue;
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
        let modelMtime: number | null = null;
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
        const units: FunctionalUnitObservation[] = unitDirs.map((unit) => {
          const fdDir = join(constructionDir, unit, "functional-design");
          let newest = 0;
          for (const f of ["entities.md", "rules.md", "functional-spec.md"]) {
            const p = join(fdDir, f);
            if (existsSync(p)) newest = Math.max(newest, statSync(p).mtimeMs);
          }
          return FunctionalUnitObservation.of(UnitName.of(unit), ArtifactModifiedAt.of(newest));
        });
        const reqModel = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        out.push(
          FunctionalObservation.of({
            location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
            units,
            modelModifiedAt: modelMtime === null ? null : ArtifactModifiedAt.of(modelMtime),
            modelUnits: modelUnits.flatMap((name) => {
              const parsed = UnitName.parse(name);
              return parsed.ok ? [parsed.value] : [];
            }),
            completedUnits: [...completedUnits].flatMap((name) => {
              const parsed = UnitName.parse(name);
              return parsed.ok ? [parsed.value] : [];
            }),
            hasFindings,
            requirementsModelModifiedAt: existsSync(reqModel)
              ? ArtifactModifiedAt.of(statSync(reqModel).mtimeMs)
              : null,
          }),
        );
      }
    }
    return UnitCoverage.of(out, scopes);
  }
}
