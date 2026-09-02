// 設計検証 finding / skip の語彙（契約2 拡張——unit 帰属つき）。witness は
// v1 判定から remap で受け継ぐ素通し値（core は remap 済みラベル列、trace /
// model / verdicts はそのまま）。conflict 判定の refinement 再解釈（対象が
// 要件 id に届く conflict は refinement-violation へ昇格する——文言は凍結）
// は finding 自身が所有する（#71 波7）。

import { TargetIds, type FrRefs } from "../../kernel/domain/index.ts";
import type { DesignValue } from "./design-value.ts";

export class DesignFinding {
  readonly #kind: string;
  readonly #frRefs: FrRefs;
  readonly #targets: TargetIds;
  readonly #witness: DesignValue;
  readonly #unit: string;
  readonly #detail: string;

  private constructor(props: {
    kind: string;
    frRefs: FrRefs;
    targets: TargetIds;
    witness: DesignValue;
    unit: string;
    detail: string;
  }) {
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }

  static reconstitute(props: {
    kind: string;
    frRefs: FrRefs;
    targets: TargetIds;
    witness: DesignValue;
    unit: string;
    detail: string;
  }): DesignFinding {
    return new DesignFinding(props);
  }

  kind(): string {
    return this.#kind;
  }

  frRefs(): FrRefs {
    return this.#frRefs;
  }

  targets(): TargetIds {
    return this.#targets;
  }

  witness(): DesignValue {
    return this.#witness;
  }

  unit(): string {
    return this.#unit;
  }

  detail(): string {
    return this.#detail;
  }

  isConflict(): boolean {
    return this.#kind === "conflict";
  }

  // conflict 判定の refinement 再解釈：対象が追加不変量の要件 id に届くなら
  // refinement-violation へ昇格する（文言は golden 凍結）。conflict でないか
  // 要件 id に届かないときは null——後者は設計自身の conflict で、呼び手は
  // masked skip の勘定へ回す。
  asRefinementViolation(reqIds: ReadonlySet<string>, unit: string): DesignFinding | null {
    if (this.#kind !== "conflict") return null;
    const reqHits = this.#targets.toArray().filter((t) => reqIds.has(t.asString()));
    if (reqHits.length === 0) return null;
    return new DesignFinding({
      kind: "refinement-violation",
      frRefs: this.#frRefs,
      targets: TargetIds.of(reqHits),
      witness: this.#witness,
      unit,
      detail: `The design machine of unit ${unit} reaches a state that violates requirements obligation ${reqHits.map((t) => t.asString()).join(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`,
    });
  }

  // 文言だけを差し替えた複製（相互包摂の畳み込み——凍結面は detail のみ）。
  withDetail(detail: string): DesignFinding {
    return new DesignFinding({
      kind: this.#kind,
      frRefs: this.#frRefs,
      targets: this.#targets,
      witness: this.#witness,
      unit: this.#unit,
      detail,
    });
  }
}
