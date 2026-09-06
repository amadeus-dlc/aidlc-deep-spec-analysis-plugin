import {
  TargetIdentifier,
  TargetIdentifiers,
  UnitName,
  type VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import type { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { LoweringIndex } from "./lowering-index.ts";
import { ReachabilityVerdict } from "./reachability-verdict.ts";
import type { RuleSubsumption } from "./rule-subsumption.ts";
import { RuleSubsumptions } from "./rule-subsumptions.ts";
import type { SiblingVerdictFindings } from "./sibling-verdict-findings.ts";
import type { SiblingVerdictSkips } from "./sibling-verdict-skips.ts";

// 各変種が必要な材料だけを持つ。読めた文書の method は必須であり、
// 無関係な変種のためにフィールドを nullable にしない。
type SiblingVerdictState =
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "unavailable"; readonly reason: string; readonly method: VerificationMethod }
  | {
      readonly kind: "readable";
      readonly method: VerificationMethod;
      readonly findings: SiblingVerdictFindings;
      readonly skipped: SiblingVerdictSkips;
    };

// v1 兄弟バックエンドの findings 文書の型付き判定面——読めなかった
// （unreadable）、バックエンドが不能を申告した（unavailable）、読めた
// （readable：method・findings・skipped）。読み手は `match` で解釈へ命じる
// ——kind を読んで分岐する代わりに（#71 波23）。
// 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す解釈もこの文書が所有する
// ——variant を知っているのは文書自身だから（BR6.3、旧 remapUnitDocument →
// LoweredUnit.remapVerdicts からの移管）。
export class SiblingVerdictDocument {
  readonly #state: SiblingVerdictState;

  private constructor(state: SiblingVerdictState) {
    this.#state = state;
  }

  static unreadable(reason = "sibling backend produced no findings document"): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "unreadable", reason });
  }

  static unavailable(reason: string, method: VerificationMethod): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "unavailable", reason, method });
  }

  static readable(
    method: VerificationMethod,
    findings: SiblingVerdictFindings,
    skipped: SiblingVerdictSkips,
  ): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "readable", method, findings, skipped });
  }

  isReadable(): boolean {
    return this.#state.kind === "readable";
  }

  // バックエンドが申告した不能理由。不能申告でなければ不在。
  unavailableReason(): string | null {
    return this.#state.kind === "unavailable" ? this.#state.reason : null;
  }

  // 到達の証跡は探索方法によらず有効。非到達を言えるのは、bounded 探索が
  // skip も中断の finding もなく完了した場合だけ。未検証も判定の一つである。
  reachabilityOf(attrPath: string, state: string): ReachabilityVerdict {
    return this.match({
      unreadable: () => ReachabilityVerdict.unverified(),
      unavailable: () => ReachabilityVerdict.unverified(),
      readable: (method, findings, skipped) => {
        for (const finding of findings) {
          if (finding.provesReachabilityOf(attrPath, state)) return ReachabilityVerdict.reached();
        }
        if (method !== "bounded" || !skipped.isEmpty() || !findings.isEmpty()) return ReachabilityVerdict.unverified();
        return ReachabilityVerdict.notReachedWithinBound();
      },
    });
  }

  match<T>(handlers: {
    unreadable: (reason: string) => T;
    unavailable: (reason: string, method: string) => T;
    readable: (method: string, findings: SiblingVerdictFindings, skipped: SiblingVerdictSkips) => T;
  }): T {
    const state = this.#state;
    switch (state.kind) {
      case "unreadable":
        return handlers.unreadable(state.reason);
      case "unavailable":
        return handlers.unavailable(state.reason, state.method.asString());
      case "readable":
        return handlers.readable(state.method.asString(), state.findings, state.skipped);
    }
  }

  // remap — lowered v1 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す。
  // 旧 remapUnitDocument の逐語移植。
  remapVerdicts(
    unit: DesignUnit,
    index: LoweringIndex,
  ): {
    readonly findings: DesignFindings;
    readonly skipped: DesignSkips;
  } & (
    | { readonly unavailable: null; readonly method: string }
    | { readonly unavailable: string; readonly method: string | null }
  ) {
    return this.match<ReturnType<SiblingVerdictDocument["remapVerdicts"]>>({
      unreadable: (reason) => ({
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([]),
        unavailable: reason,
        method: null,
      }),
      unavailable: (reason, method) => ({
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([]),
        unavailable: reason,
        method,
      }),
      readable: (method, findings, skipped) => this.#remapReadable(unit, index, method, findings, skipped),
    });
  }

  // 各診断が再割り当てを行い、文書は包摂関係とskipの重複を整理する。
  #remapReadable(
    u: DesignUnit,
    index: LoweringIndex,
    method: string,
    docFindings: SiblingVerdictFindings,
    docSkipped: SiblingVerdictSkips,
  ): ReturnType<SiblingVerdictDocument["remapVerdicts"]> {
    const unit = UnitName.of(u.name());
    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const waived = new Set<string>();
    const deadDesignIds = new Set<string>();
    const relations: RuleSubsumption[] = [];

    for (const source of docFindings) {
      const result = source.remap(unit, index);
      switch (result.kind) {
        case "finding":
          findings.push(result.finding);
          break;
        case "unreachable":
          deadDesignIds.add(result.target.asString());
          findings.push(result.finding);
          break;
        case "subsumption":
          relations.push(result.relation);
          break;
        case "waived":
          for (const skip of result.skipped) {
            const target = skip.target().asString();
            if (!waived.has(target)) {
              waived.add(target);
              skipped.push(skip);
            }
          }
          break;
        case "ignored":
          break;
      }
    }

    const subsumptions = RuleSubsumptions.parse(relations);
    if (!subsumptions.ok)
      return {
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([]),
        unavailable: `subsumption analysis failed: ${subsumptions.error.kind}`,
        method,
      };
    findings.push(
      ...subsumptions.value.findingsExcept(TargetIdentifiers.of([...deadDesignIds].map(TargetIdentifier.of))),
    );

    const seenSkip = new Set<string>();
    for (const source of docSkipped) {
      const mapped = source.remap(unit, index);
      if (mapped === null) continue;
      const key = `${mapped.target().asString()}|${mapped.reason()}`;
      if (!seenSkip.has(key)) {
        seenSkip.add(key);
        skipped.push(mapped);
      }
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped), unavailable: null, method };
  }
}
