import type { LineNumber } from "./line-number.ts";
import type { RuleDecls } from "./rule-decls.ts";

// rules.md の yaml 真実源ブロックの解析結果——文書が無い、フェンス数が違う、
// 解析できない、`rules:` リストが無い、抽出できた。FD-R 検査は `match` で
// 解釈へ命じる（#71 波26）。
export class RulesOutcome {
  readonly #kind: "absent" | "wrong-fence-count" | "unparseable" | "no-rules-list" | "extracted";
  readonly #found: number;
  readonly #line: LineNumber | null;
  readonly #error: string | null;
  readonly #rules: RuleDecls | null;

  private constructor(props: { kind: "absent" | "wrong-fence-count" | "unparseable" | "no-rules-list" | "extracted"; found: number; line: LineNumber | null; error: string | null; rules: RuleDecls | null }) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#rules = props.rules;
  }

  static absent(): RulesOutcome {
    return new RulesOutcome({ kind: "absent", found: 0, line: null, error: null, rules: null });
  }

  static wrongFenceCount(found: number): RulesOutcome {
    return new RulesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, rules: null });
  }

  static unparseable(line: LineNumber, error: string): RulesOutcome {
    return new RulesOutcome({ kind: "unparseable", found: 0, line, error, rules: null });
  }

  static noRulesList(): RulesOutcome {
    return new RulesOutcome({ kind: "no-rules-list", found: 0, line: null, error: null, rules: null });
  }

  static extracted(rules: RuleDecls): RulesOutcome {
    return new RulesOutcome({ kind: "extracted", found: 0, line: null, error: null, rules });
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
    extracted: (rules: RuleDecls) => T;
  }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "wrong-fence-count") return handlers.wrongFenceCount(this.#found);
    if (this.#kind === "unparseable" && this.#line !== null) return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#kind === "no-rules-list") return handlers.noRulesList();
    if (this.#rules === null) throw new Error("defect: an extracted rules document carries no rules");
    return handlers.extracted(this.#rules);
  }
}
