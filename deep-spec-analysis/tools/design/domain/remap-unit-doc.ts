// remap — lowered v1 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す。
// lowered id は設計向けテキストへ決して漏れない：v1 detail 内の OB-n 参照は
// 設計 id へ書き換える（"DOB-2" は \bOB-2\b 境界を含まないため二重書き換えは
// 起きない）。vac-dead は unreachable へ、vac-shadow は redundancy へ変換し、
// 相互包摂（両方向証明）は 1 件の「等価」finding へ畳む。deterministic: false
// を宣言した機械の同 (state,trigger) 重複 conflict は waived skip へ（人間承認
// 済みのモデル waiver——沈黙ではない）。文言はすべて golden 凍結。
// 旧 deep-spec-design-lib.ts の remapUnitDocument は LoweredUnit#remapVerdicts
// になった（OOUI 裁定）——ここは判定面の型とコレクションだけを持つ。

import type { DesignFindings, DesignSkips } from "./design-finding.ts";
import type { DesignValue } from "./design-value.ts";

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

// 兄弟バックエンド判定 finding のファーストクラスコレクション（文書順を保持）。
export class SiblingVerdictFindings {
  readonly #values: readonly SiblingVerdictFinding[];

  private constructor(values: readonly SiblingVerdictFinding[]) {
    this.#values = values;
  }

  static of(values: readonly SiblingVerdictFinding[]): SiblingVerdictFindings {
    return new SiblingVerdictFindings([...values]);
  }

  add(value: SiblingVerdictFinding): SiblingVerdictFindings {
    return new SiblingVerdictFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SiblingVerdictFinding> {
    yield* this.#values;
  }

  toArray(): readonly SiblingVerdictFinding[] {
    return this.#values;
  }
}

// 兄弟バックエンド判定 skip のファーストクラスコレクション（文書順を保持）。
export class SiblingVerdictSkips {
  readonly #values: readonly SiblingVerdictSkip[];

  private constructor(values: readonly SiblingVerdictSkip[]) {
    this.#values = values;
  }

  static of(values: readonly SiblingVerdictSkip[]): SiblingVerdictSkips {
    return new SiblingVerdictSkips([...values]);
  }

  add(value: SiblingVerdictSkip): SiblingVerdictSkips {
    return new SiblingVerdictSkips([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SiblingVerdictSkip> {
    yield* this.#values;
  }

  toArray(): readonly SiblingVerdictSkip[] {
    return this.#values;
  }
}

export type SiblingVerdictDocument =
  | { kind: "unreadable" }
  | { kind: "unavailable"; reason: string; method: string | null }
  | { kind: "readable"; method: string | null; findings: SiblingVerdictFindings; skipped: SiblingVerdictSkips };

export interface RemappedUnit {
  readonly findings: DesignFindings;
  readonly skipped: DesignSkips;
  unavailable: string | null;
  method: string | null;
}

