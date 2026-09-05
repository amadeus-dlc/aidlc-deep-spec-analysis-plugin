import type { LineNumber } from "./line-number.ts";
import type { RuleDeclarations } from "./rule-declarations.ts";
import { FindingKind, type ArtifactPath, type RequirementIdentifiers } from "@deep-spec/kernel-domain";
import type { DeclaredEntities } from "./declared-entities.ts";
import { FD_R1, FD_R2, FD_R3, FD_R4, FD_R5 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";
import { FenceCount } from "./fence-count.ts";

// rules.md の yaml 真実源ブロックの解析結果——文書が無い、フェンス数が違う、
// 解析できない、`rules:` リストが無い、抽出できた。FD-R 検査は `match` で
// 解釈へ命じる（#71 波26）。
export class RulesOutcome {
  readonly #kind: "absent" | "wrong-fence-count" | "unparseable" | "no-rules-list" | "extracted";
  readonly #found: FenceCount;
  readonly #line: LineNumber | null;
  readonly #error: string | null;
  readonly #rules: RuleDeclarations | null;

  private constructor(props: { kind: "absent" | "wrong-fence-count" | "unparseable" | "no-rules-list" | "extracted"; found: FenceCount; line: LineNumber | null; error: string | null; rules: RuleDeclarations | null }) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#rules = props.rules;
  }

  static absent(): RulesOutcome {
    return new RulesOutcome({ kind: "absent", found: FenceCount.of(0), line: null, error: null, rules: null });
  }

  static wrongFenceCount(found: FenceCount): RulesOutcome {
    return new RulesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, rules: null });
  }

  static unparseable(line: LineNumber, error: string): RulesOutcome {
    return new RulesOutcome({ kind: "unparseable", found: FenceCount.of(0), line, error, rules: null });
  }

  static noRulesList(): RulesOutcome {
    return new RulesOutcome({ kind: "no-rules-list", found: FenceCount.of(0), line: null, error: null, rules: null });
  }

  static extracted(rules: RuleDeclarations): RulesOutcome {
    return new RulesOutcome({ kind: "extracted", found: FenceCount.of(0), line: null, error: null, rules });
  }

  // 抽出できたか——リポジトリは requirements.md をこのときだけ読む（凍結された取得条件）。
  isExtracted(): boolean {
    return this.#kind === "extracted";
  }

  match<T>(handlers: {
    absent: () => T;
    wrongFenceCount: (found: number) => T;
    unparseable: (line: LineNumber, error: string) => T;
    noRulesList: () => T;
    extracted: (rules: RuleDeclarations) => T;
  }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "wrong-fence-count") return handlers.wrongFenceCount(this.#found.asNumber());
    if (this.#kind === "unparseable" && this.#line !== null) return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#kind === "no-rules-list") return handlers.noRulesList();
    if (this.#rules === null) throw new Error("defect: an extracted rules document carries no rules");
    return handlers.extracted(this.#rules);
  }


  // FD-R1 の門（種別規律の裁定 13）: 文書が無ければ FD-R を skip、fence や
  // `rules:` リストが崩れていれば finding と blocked スキップ。抽出できれば
  // 規則集合が FD-R1..R5 を書く（R3 は requirements の id 集合、R4 は entities
  // の宣言集合に対して）。文言は golden 凍結。
  check(report: ReferenceCheckReport, artifact: ArtifactPath, requirementIdsKnown: RequirementIdentifiers | null, entities: DeclaredEntities | null): void {
    const art = artifact.asString();
    const blockRs = (why: string): void => {
      for (const f of [FD_R2, FD_R3, FD_R4, FD_R5]) report.skip(f, "unrecognized-format", why);
    };
    this.match<void>({
      absent: () => {
        for (const f of [FD_R1, FD_R2, FD_R3, FD_R4, FD_R5]) {
          report.skip(f, "absent-input", "rules.md is not present in this unit's functional-design record");
        }
      },
      wrongFenceCount: (found) => {
        report.finding(FD_R1, FindingKind.structureInvalid(), [FD_R1.asCheckTarget()], [WitnessReference.at(art, "yaml fence")],
          `rules.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      unparseable: (line, error) => {
        report.finding(FD_R1, FindingKind.structureInvalid(), [FD_R1.asCheckTarget()], [WitnessReference.at(art, `yaml fence (line ${line.asNumber()})`)],
          `yaml block does not parse in the supported subset: ${error}`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      noRulesList: () => {
        report.finding(FD_R1, FindingKind.structureInvalid(), [FD_R1.asCheckTarget()], [WitnessReference.at(art, "rules")],
          "top-level `rules:` list is missing");
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      extracted: (ruleDecls) => {
        ruleDecls.check(report, artifact, requirementIdsKnown, entities);
      },
    });
  }
}
