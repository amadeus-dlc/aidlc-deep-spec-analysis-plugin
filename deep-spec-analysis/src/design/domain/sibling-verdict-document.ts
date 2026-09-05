import { UnitName, FindingKind, SkipReason, TargetId, TargetIds, VerificationMethod } from "@deep-spec/kernel-domain";

import type { SiblingVerdictFindings } from "./sibling-verdict-findings.ts";
import type { SiblingVerdictSkips } from "./sibling-verdict-skips.ts";

import type { DesignUnit } from "./design-unit.ts";
import { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { LoweredOrigin } from "./lowered-origin.ts";
import type { LoweringIndex } from "./lowering-index.ts";
import { ReachabilityVerdict } from "./reachability-verdict.ts";

// 各変種が必要な材料だけを持つ。読めた文書の method は必須であり、
// 無関係な変種のためにフィールドを nullable にしない。
type SiblingVerdictState =
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "unavailable"; readonly reason: string; readonly method: VerificationMethod }
  | { readonly kind: "readable"; readonly method: VerificationMethod; readonly findings: SiblingVerdictFindings; readonly skipped: SiblingVerdictSkips };

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

  static readable(method: VerificationMethod, findings: SiblingVerdictFindings, skipped: SiblingVerdictSkips): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "readable", method, findings, skipped });
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
      case "unreadable": return handlers.unreadable(state.reason);
      case "unavailable": return handlers.unavailable(state.reason, state.method.asString());
      case "readable": return handlers.readable(state.method.asString(), state.findings, state.skipped);
    }
  }

  // remap — lowered v1 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す。
  // 旧 remapUnitDocument の逐語移植。
  remapVerdicts(unit: DesignUnit, index: LoweringIndex): {
    readonly findings: DesignFindings;
    readonly skipped: DesignSkips;
  } & (
    | { readonly unavailable: null; readonly method: string }
    | { readonly unavailable: string; readonly method: string | null }
  ) {
    return this.match<ReturnType<SiblingVerdictDocument["remapVerdicts"]>>({
      unreadable: (reason) => ({ findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: reason, method: null }),
      unavailable: (reason, method) => ({ findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: reason, method }),
      readable: (method, findings, skipped) => this.#remapReadable(unit, index, method, findings, skipped),
    });
  }

  // 読めた文書の再割り当て本体（旧 remapVerdicts の readable 分岐、逐語）。
  #remapReadable(u: DesignUnit, index: LoweringIndex, method: string, docFindings: SiblingVerdictFindings, docSkipped: SiblingVerdictSkips): Extract<ReturnType<SiblingVerdictDocument["remapVerdicts"]>, { unavailable: null }> {
    const mapTarget = (t: string): { design: string; entry: LoweredOrigin | null } => index.resolveDesignTarget(t);
    const rewriteLabel = (label: string): string => index.rewriteLoweredIdTokens(label);
    const remapDetail = (detail: string): string => index.rewriteLoweredIds(detail);

    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const waived = new Set<string>();
    const deadDesignIds = new Set<string>();
    const shadowFindings: { finding: DesignFinding; subsumer: string; subsumed: string }[] = [];

    for (const f of docFindings) {
      const mapped = f.targets().map((t) => mapTarget(t.asString()));
      const frRefs = f.frRefs();
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
            frRefs,
            targets: TargetIds.of(Array.from([design], (raw) => TargetId.of(raw))),
            witness,
            unit: UnitName.of(u.name()),
            detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`,
          }),
        );
        continue;
      }
      if (synth?.entry?.isKind("vac-shadow") && f.isKind("conflict")) {
        const pairRefs = synth.entry.pairRefs();
        const pair = [pairRefs[0].asString(), pairRefs[1].asString()] as const;
        shadowFindings.push({
          finding: DesignFinding.of({
            kind: FindingKind.redundancy(),
            frRefs,
            targets: TargetIds.of(Array.from([pair[0], pair[1]], (raw) => TargetId.of(raw))).sortedUniqueCanonically(),
            witness,
            unit: UnitName.of(u.name()),
            detail: `${pair[1]} is subsumed by ${pair[0]}: same trigger, a provably narrower guard, and an identical effect — it can never apply where ${pair[0]} does not.`,
          }),
          subsumer: pair[0],
          subsumed: pair[1],
        });
        continue;
      }
      if (synth) continue; // 合成に触れる他の判定はノイズ

      const targets = TargetIds.of(Array.from(mapped.map((m) => m.design), (raw) => TargetId.of(raw))).sortedUniqueCanonically().toStrings();
      // deterministic:false waiver：同トリガ conflict の対象がすべて、非決定を
      // 宣言した 1 機械の遷移であるとき（判定は機械自身へ命じる——波7）。
      if (f.isKind("conflict") && targets.length > 0) {
        const machines = targets.map((t) => index.machineOfTransition(t));
        const first = machines[0];
        if (first !== null && first !== undefined && first.waivesOverlapOf(machines)) {
          for (const t of targets) {
            if (!waived.has(t)) {
              waived.add(t);
              skipped.push(DesignSkipped.of({
                target: TargetId.of(t),
                reason: SkipReason.waived(),
                unit: UnitName.of(u.name()),
                detail: `machine ${first.id().asString()} declares deterministic: false — the same-(state,trigger) overlap check is waived by the model`,
              }));
            }
          }
          continue;
        }
      }
      // 兄弟バックエンドの検証済み判定を設計側の座標へ写す。
      findings.push(DesignFinding.of({ kind: FindingKind.of(f.kind()), frRefs, targets: TargetIds.of(Array.from(targets, (raw) => TargetId.of(raw))), witness, unit: UnitName.of(u.name()), detail }));
    }

    // shadow の後段：死んだルール/遷移は既に unreachable——その空虚な包摂は何も
    // 加えない。相互包摂（両方向証明）は 1 件の「等価」finding へ畳む。
    const liveShadows = shadowFindings.filter((s) => !deadDesignIds.has(s.subsumed) && !deadDesignIds.has(s.subsumer));
    const byPair = new Map<string, typeof liveShadows>();
    for (const s of liveShadows) {
      const key = s.finding.targets().joined(",");
      const list = byPair.get(key) ?? [];
      list.push(s);
      byPair.set(key, list);
    }
    for (const key of [...byPair.keys()].sort()) {
      const list = byPair.get(key) ?? [];
      const directions = new Set(list.map((s) => `${s.subsumer}>${s.subsumed}`));
      const first = list[0];
      if (!first) continue;
      if (list.length >= 2 && directions.size >= 2) {
        const [a, b] = first.finding.targets().toStrings();
        findings.push(
          first.finding.withDetail(`${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.`),
        );
      } else {
        findings.push(first.finding);
      }
    }

    const seenSkip = new Set<string>();
    for (const s of docSkipped) {
      const { design, entry } = mapTarget(s.target().asString());
      if (entry?.isSyntheticProbe()) continue; // 合成の予算ノイズ
      const detail = s.detail();
      const key = `${design}|${s.reason()}`;
      if (seenSkip.has(key)) continue;
      seenSkip.add(key);
      skipped.push(DesignSkipped.of({
        target: TargetId.of(design),
        reason: SkipReason.of(s.reason()),
        unit: UnitName.of(u.name()),
        ...(detail !== undefined ? { detail: remapDetail(detail) } : {}),
      }));
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped), unavailable: null, method };
  }
}
