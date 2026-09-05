import type { LoweredOriginReference } from "./lowered-origin-reference.ts";

// 降ろし方の閉じた集合——帰属の内部表現（裁定 17）。外からは isKind / isSyntheticProbe で問う。
type LoweringKind = "passthrough" | "transition" | "ignore" | "vac-dead" | "vac-shadow";

// lowered 義務の設計帰属——降ろし元の設計 id、降ろし方（passthrough / transition
// / ignore / 到達不能プローブ / 影プローブ）、影プローブなら対。プローブか
// どうかと対の参照は帰属自身の知識（#71 波20）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredOriginParam = {
  design: LoweredOriginReference;
  kind: LoweringKind;
  pair?: readonly [LoweredOriginReference, LoweredOriginReference];
};

export class LoweredOrigin {
  readonly #design: LoweredOriginReference;
  readonly #kind: LoweringKind;
  readonly #pair: readonly [LoweredOriginReference, LoweredOriginReference] | undefined;

  private constructor(props: LoweredOriginParam) {
    this.#design = props.design;
    this.#kind = props.kind;
    this.#pair = props.pair;
  }

  static of(props: LoweredOriginParam): LoweredOrigin {
    return new LoweredOrigin(props);
  }

  design(): LoweredOriginReference {
    return this.#design;
  }

  isKind(kind: LoweringKind): boolean {
    return this.#kind === kind;
  }

  // 合成プローブ（到達不能・影）の帰属か——remap がノイズとして落とす skip の判定面。
  isSyntheticProbe(): boolean {
    return this.#kind === "vac-dead" || this.#kind === "vac-shadow";
  }

  // 影プローブの対（対を持たない帰属は自分自身との対——凍結挙動）。
  pairRefs(): readonly [LoweredOriginReference, LoweredOriginReference] {
    return this.#pair ?? [this.#design, this.#design];
  }
}
