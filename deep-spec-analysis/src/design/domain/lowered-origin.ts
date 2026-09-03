import type { LoweredOriginRef } from "./lowered-origin-ref.ts";

// 降ろし方の閉じた集合——帰属の内部表現（裁定 17）。外からは isKind / isSyntheticProbe で問う。
type LoweringKind = "passthrough" | "transition" | "ignore" | "vac-dead" | "vac-shadow";

// lowered 義務の設計帰属——降ろし元の設計 id、降ろし方（passthrough / transition
// / ignore / 到達不能プローブ / 影プローブ）、影プローブなら対。プローブか
// どうかと対の参照は帰属自身の知識（#71 波20）。
export class LoweredOrigin {
  readonly #design: LoweredOriginRef;
  readonly #kind: LoweringKind;
  readonly #pair: readonly [LoweredOriginRef, LoweredOriginRef] | undefined;

  private constructor(props: { design: LoweredOriginRef; kind: LoweringKind; pair?: readonly [LoweredOriginRef, LoweredOriginRef] }) {
    this.#design = props.design;
    this.#kind = props.kind;
    this.#pair = props.pair;
  }

  static reconstitute(props: { design: LoweredOriginRef; kind: LoweringKind; pair?: readonly [LoweredOriginRef, LoweredOriginRef] }): LoweredOrigin {
    return new LoweredOrigin(props);
  }

  design(): LoweredOriginRef {
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
  pairRefs(): readonly [LoweredOriginRef, LoweredOriginRef] {
    return this.#pair ?? [this.#design, this.#design];
  }
}
