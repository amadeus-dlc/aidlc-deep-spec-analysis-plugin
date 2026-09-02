import type { LoweredOriginRef } from "./lowered-origin-ref.ts";
import type { LoweringKind } from "./lowering-kind.ts";

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

  kind(): LoweringKind {
    return this.#kind;
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
