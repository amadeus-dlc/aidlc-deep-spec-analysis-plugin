import {
  FindingKind,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  UnitName,
  type VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { LoweredOrigin } from "./lowered-origin.ts";
import type { LoweringIndex } from "./lowering-index.ts";
import { ReachabilityVerdict } from "./reachability-verdict.ts";
import { RuleSubsumption } from "./rule-subsumption.ts";
import { RuleSubsumptionVerdict } from "./rule-subsumption-verdict.ts";
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

  // 読めた文書の再割り当て本体（旧 remapVerdicts の readable 分岐、逐語）。
  #remapReadable(
    u: DesignUnit,
    index: LoweringIndex,
    method: string,
    docFindings: SiblingVerdictFindings,
    docSkipped: SiblingVerdictSkips,
  ): ReturnType<SiblingVerdictDocument["remapVerdicts"]> {
    const mapTarget = (t: string): { design: string; entry: LoweredOrigin | null } => index.resolveDesignTarget(t);
    const rewriteLabel = (label: string): string => index.rewriteLoweredIdTokens(label);
    const remapDetail = (detail: string): string => index.rewriteLoweredIds(detail);

    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const waived = new Set<string>();
    const deadDesignIds = new Set<string>();
    const relations: RuleSubsumption[] = [];

    for (const f of docFindings) {
      const mapped = f.targets().map((t) => mapTarget(t.asString()));
      const functionalRequirementReferences = f.functionalRequirementReferences();
      const detail = remapDetail(f.detail());
      const witness = f.witnessRemappedBy(rewriteLabel);

      const synth = mapped.find((m) => m.entry?.isSyntheticProbe());
      if (synth?.entry?.isKind("vac-dead") && f.isKind("conflict")) {
        const design = synth.entry.design().asString();
        const isTransition = index.isTransition(design);
        deadDesignIds.add(design);
        findings.push(
          DesignFinding.of({
            kind: FindingKind.unreachable(),
            functionalRequirementReferences: functionalRequirementReferences,
            targets: TargetIdentifiers.of(Array.from([design], (raw) => TargetIdentifier.of(raw))),
            witness,
            unit: UnitName.of(u.name()),
            detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`,
          }),
        );
        continue;
      }
      const probe = synth?.entry?.subsumptionProbe();
      if (probe != null) {
        const verdict = RuleSubsumptionVerdict.fromFinding(probe, f, witness, UnitName.of(u.name()));
        const relation = RuleSubsumption.parse(verdict);
        if (relation.ok) relations.push(relation.value);
        continue;
      }
      if (synth) continue; // 合成に触れる他の判定はノイズ

      const targets = TargetIdentifiers.of(
        Array.from(
          mapped.map((m) => m.design),
          (raw) => TargetIdentifier.of(raw),
        ),
      )
        .sortedUniqueCanonically()
        .toStrings();
      // deterministic:false waiver：同トリガ conflict の対象がすべて、非決定を
      // 宣言した 1 機械の遷移であるとき（判定は機械自身へ命じる——波7）。
      if (f.isKind("conflict") && targets.length > 0) {
        const machines = targets.map((t) => index.machineOfTransition(t));
        const first = machines[0];
        if (first?.waivesOverlapOf(machines)) {
          for (const t of targets) {
            if (!waived.has(t)) {
              waived.add(t);
              skipped.push(
                DesignSkipped.of({
                  target: TargetIdentifier.of(t),
                  reason: SkipReason.waived(),
                  unit: UnitName.of(u.name()),
                  detail: `machine ${first.id().asString()} declares deterministic: false — the same-(state,trigger) overlap check is waived by the model`,
                }),
              );
            }
          }
          continue;
        }
      }
      // 兄弟バックエンドの検証済み判定を設計側の座標へ写す。
      findings.push(
        DesignFinding.of({
          kind: FindingKind.of(f.kind()),
          functionalRequirementReferences: functionalRequirementReferences,
          targets: TargetIdentifiers.of(Array.from(targets, (raw) => TargetIdentifier.of(raw))),
          witness,
          unit: UnitName.of(u.name()),
          detail,
        }),
      );
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
    for (const s of docSkipped) {
      const { design, entry } = mapTarget(s.target().asString());
      if (entry?.isSyntheticProbe()) continue; // 合成の予算ノイズ
      const detail = s.detail();
      const key = `${design}|${s.reason()}`;
      if (seenSkip.has(key)) continue;
      seenSkip.add(key);
      skipped.push(
        DesignSkipped.of({
          target: TargetIdentifier.of(design),
          reason: SkipReason.of(s.reason()),
          unit: UnitName.of(u.name()),
          ...(detail !== undefined ? { detail: remapDetail(detail) } : {}),
        }),
      );
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped), unavailable: null, method };
  }
}
