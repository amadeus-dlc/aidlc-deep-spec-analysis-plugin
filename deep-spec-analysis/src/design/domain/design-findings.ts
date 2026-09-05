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

export class DesignFindings {
  readonly #values: readonly DesignFinding[];

  private constructor(values: readonly DesignFinding[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignFinding[]): DesignFindings {
    return new DesignFindings(values);
  }

  add(value: DesignFinding): DesignFindings {
    return new DesignFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignFinding> {
    yield* this.#values;
  }

  sortedCanonically(): DesignFindings {
    return new DesignFindings(sortDesignFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly DesignFinding[] {
    return this.#values;
  }
}
