import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignFinding } from "./design-finding.ts";

// 設計バックエンドの正準順: kind 順位（kernel の FindingKind）→ unit → targets
// → detail。tiebreak は v1 と異なり unit が kind の直後に入る（凍結挙動）。
function sortDesignFindings(findings: readonly DesignFinding[]): DesignFinding[] {
  return [...findings].sort((a, b) => {
    const kr = a.compareKindTo(b);
    if (kr !== 0) return kr;
    if (a.unit() !== b.unit()) return a.unit() < b.unit() ? -1 : 1;
    const ta = a.targets().joined(",");
    const tb = b.targets().joined(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail() < b.detail() ? -1 : a.detail() > b.detail() ? 1 : 0;
  });
}

// finding / skip のファーストクラスコレクション。契約2 拡張（設計 11-kind
// 順位）の正準ソートという集合の知識を所有する。

export class DesignFindings extends FirstClassCollectionBase<DesignFinding, DesignFindings> {
  readonly #values: readonly DesignFinding[];

  private constructor(values: readonly DesignFinding[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-findings");
  }

  protected override rebuild(values: readonly DesignFinding[]): DesignFindings {
    return new DesignFindings(values);
  }

  static of(values: readonly DesignFinding[]): DesignFindings {
    return new DesignFindings(values);
  }

  override map(transform: (element: DesignFinding) => DesignFinding): DesignFindings {
    return this.mapTo(transform, DesignFindings.of);
  }

  override combine(other: DesignFindings): DesignFindings {
    return this.combineTo(other, DesignFindings.of);
  }

  static parse(values: readonly DesignFinding[]): Result<DesignFindings, ParseError> {
    return parseConstruction(() => new DesignFindings(values));
  }

  add(value: DesignFinding): DesignFindings {
    return new DesignFindings([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignFinding> {
    yield* this.#values;
  }

  sortedCanonically(): DesignFindings {
    return new DesignFindings(sortDesignFindings(this.#values));
  }

  override count(): number {
    return this.#values.length;
  }

  // 境界: 描画専用。契約2 の finding キー順（kind, frRefs, targets, witness,
  // unit, detail）は旧構築サイトの挿入順そのもの（golden バイト凍結）。
  toDocuments(): Json[] {
    return this.#values.map((finding) => {
      const out: { [k: string]: Json } = {
        kind: finding.kind(),
        frRefs: finding.functionalRequirementReferences().toStrings() as unknown as Json,
        targets: finding.targets().toStrings() as unknown as Json,
        witness: finding.witness().toDocument() as unknown as Json,
        unit: finding.unit(),
        detail: finding.detail(),
      };
      return out as Json;
    });
  }

  toArray(): readonly DesignFinding[] {
    return this.#values;
  }
}
