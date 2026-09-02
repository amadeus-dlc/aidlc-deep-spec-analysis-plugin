// refcheck finding の witness ref——成果物・要素パス・任意の値。finding が指す
// 証拠の座標であり、(artifact, element) の一致判定は ref 自身の知識（#71
// 波19）。artifact は記録相対の成果物名、element は要素パス、value は生の
// 名前（サニタイズ前の原文が生き残る場所）。
export class WitnessRef {
  readonly #artifact: string;
  readonly #element: string;
  readonly #value: string | undefined;

  private constructor(props: { artifact: string; element: string; value?: string }) {
    this.#artifact = props.artifact;
    this.#element = props.element;
    this.#value = props.value;
  }

  static reconstitute(props: { artifact: string; element: string; value?: string }): WitnessRef {
    return new WitnessRef(props);
  }

  artifact(): string {
    return this.#artifact;
  }

  element(): string {
    return this.#element;
  }

  value(): string | undefined {
    return this.#value;
  }

  pointsAt(artifact: string, element: string): boolean {
    return this.#artifact === artifact && this.#element === element;
  }
}
