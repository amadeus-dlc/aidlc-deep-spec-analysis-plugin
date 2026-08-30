// remap — lowered v1 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す。
// lowered id は設計向けテキストへ決して漏れない：v1 detail 内の OB-n 参照は
// 設計 id へ書き換える（"DOB-2" は \bOB-2\b 境界を含まないため二重書き換えは
// 起きない）。vac-dead は unreachable へ、vac-shadow は redundancy へ変換し、
// 相互包摂（両方向証明）は 1 件の「等価」finding へ畳む。deterministic: false
// を宣言した機械の同 (state,trigger) 重複 conflict は waived skip へ（人間承認
// 済みのモデル waiver——沈黙ではない）。文言はすべて golden 凍結。
// 旧 deep-spec-design-lib.ts の remapUnitDocument からの逐語移植（Json の選別は
// アダプタのパーサが済ませ、ここは型付き判定を受ける）。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { DesignFinding, DesignSkipped } from "./design-finding.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { DesignValue } from "./design-value.ts";
import type { LoweredOrigin, LoweredUnit } from "./lower-unit.ts";

// アダプタのパーサが素の v1 文書から選別した型付き判定面。
export interface SiblingVerdictFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: DesignValue;
  detail: string;
}

export interface SiblingVerdictSkip {
  target: string;
  reason: string;
  detail?: string;
}

export type SiblingVerdictDocument =
  | { kind: "unreadable" }
  | { kind: "unavailable"; reason: string; method: string | null }
  | { kind: "readable"; method: string | null; findings: SiblingVerdictFinding[]; skipped: SiblingVerdictSkip[] };

export interface RemappedUnit {
  findings: DesignFinding[];
  skipped: DesignSkipped[];
  unavailable: string | null;
  method: string | null;
}

function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function isRecord(v: DesignValue): v is { [k: string]: DesignValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function remapUnitDocument(u: DesignUnit, low: LoweredUnit, doc: SiblingVerdictDocument): RemappedUnit {
  if (doc.kind === "unreadable") {
    return { findings: [], skipped: [], unavailable: "sibling backend produced no findings document", method: null };
  }
  if (doc.kind === "unavailable") {
    return { findings: [], skipped: [], unavailable: doc.reason, method: doc.method };
  }
  const method = doc.method;
  const mapTarget = (t: string): { design: string; entry: LoweredOrigin | null } => {
    const entry = low.map.get(t) ?? null;
    if (entry) return { design: entry.design, entry };
    const dsc = low.scenarioMap.get(t);
    if (dsc) return { design: dsc, entry: null };
    return { design: t, entry: null };
  };
  const remapCore = (core: DesignValue): DesignValue => {
    if (!Array.isArray(core)) return core;
    return core.map((label) => {
      if (typeof label !== "string") return label;
      return label.replace(/OB_([0-9]+)/g, (m, num) => {
        const entry = low.map.get(`OB-${num}`);
        return entry ? designToken(entry.design) : m;
      });
    });
  };
  const remapDetail = (detail: string): string =>
    detail.replace(/\bOB-([0-9]+)\b/g, (m, num) => low.map.get(`OB-${num}`)?.design ?? m);

  const findings: DesignFinding[] = [];
  const skipped: DesignSkipped[] = [];
  const waived = new Set<string>();
  const deadDesignIds = new Set<string>();
  const shadowFindings: { finding: DesignFinding; subsumer: string; subsumed: string }[] = [];

  for (const f of doc.findings) {
    const mapped = f.targets.map(mapTarget);
    const frRefs = f.frRefs;
    const detail = remapDetail(f.detail);
    let witness = f.witness;
    if (isRecord(witness) && "core" in witness) {
      witness = { core: remapCore(witness.core ?? null) };
    }

    const synth = mapped.find((m) => m.entry?.kind === "vac-dead" || m.entry?.kind === "vac-shadow");
    if (synth?.entry?.kind === "vac-dead" && f.kind === "conflict") {
      const design = synth.entry.design;
      const isTransition = low.machineOfTransition.has(design);
      deadDesignIds.add(design);
      findings.push({
        kind: "unreachable",
        frRefs,
        targets: [design],
        witness,
        unit: u.name(),
        detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`,
      });
      continue;
    }
    if (synth?.entry?.kind === "vac-shadow" && f.kind === "conflict") {
      const pair = synth.entry.pair ?? [synth.entry.design, synth.entry.design];
      shadowFindings.push({
        finding: {
          kind: "redundancy",
          frRefs,
          targets: sortedUnique([pair[0], pair[1]], idCompare),
          witness,
          unit: u.name(),
          detail: `${pair[1]} is subsumed by ${pair[0]}: same trigger, a provably narrower guard, and an identical effect — it can never apply where ${pair[0]} does not.`,
        },
        subsumer: pair[0],
        subsumed: pair[1],
      });
      continue;
    }
    if (synth) continue; // 合成に触れる他の判定はノイズ

    const targets = sortedUnique(mapped.map((m) => m.design), idCompare);
    // deterministic:false waiver：同トリガ conflict の対象がすべて、非決定を
    // 宣言した 1 機械の遷移であるとき。
    if (f.kind === "conflict" && targets.length > 0) {
      const machines = targets.map((t) => low.machineOfTransition.get(t));
      const first = machines[0];
      if (first && machines.every((m) => m === first) && first.deterministic === false) {
        for (const t of targets) {
          if (!waived.has(t)) {
            waived.add(t);
            skipped.push({
              target: t,
              reason: "waived",
              unit: u.name(),
              detail: `machine ${first.id} declares deterministic: false — the same-(state,trigger) overlap check is waived by the model`,
            });
          }
        }
        continue;
      }
    }
    findings.push({ kind: f.kind, frRefs, targets, witness, unit: u.name(), detail });
  }

  // shadow の後段：死んだルール/遷移は既に unreachable——その空虚な包摂は何も
  // 加えない。相互包摂（両方向証明）は 1 件の「等価」finding へ畳む。
  const liveShadows = shadowFindings.filter((s) => !deadDesignIds.has(s.subsumed) && !deadDesignIds.has(s.subsumer));
  const byPair = new Map<string, typeof liveShadows>();
  for (const s of liveShadows) {
    const key = s.finding.targets.join(",");
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
      const [a, b] = first.finding.targets;
      findings.push({
        ...first.finding,
        detail: `${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.`,
      });
    } else {
      findings.push(first.finding);
    }
  }

  const seenSkip = new Set<string>();
  for (const s of doc.skipped) {
    const { design, entry } = mapTarget(s.target);
    if (entry?.kind === "vac-dead" || entry?.kind === "vac-shadow") continue; // 合成の予算ノイズ
    const key = `${design}|${s.reason}`;
    if (seenSkip.has(key)) continue;
    seenSkip.add(key);
    const out: DesignSkipped = { target: design, reason: s.reason, unit: u.name() };
    if (typeof s.detail === "string") out.detail = remapDetail(s.detail);
    skipped.push(out);
  }
  return { findings, skipped, unavailable: null, method };
}
