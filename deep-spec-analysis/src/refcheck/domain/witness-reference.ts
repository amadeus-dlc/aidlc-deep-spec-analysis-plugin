import { ArtifactPath } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import { ElementPath } from "./element-path.ts";

// refcheck finding の witness ref——成果物・要素パス・任意の値。finding が指す
// 証拠の座標であり、(artifact, element) の一致判定は ref 自身の知識（#71
// 波19）。artifact は記録相対の成果物名、element は要素パス、value は生の
// 名前（サニタイズ前の原文が生き残る場所）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type WitnessReferenceParam = { artifact: string; element: string; value?: string };

export class WitnessReference {
  readonly #artifact: ArtifactPath;
  readonly #element: ElementPath;
  readonly #value: string | undefined;

  private constructor(props: WitnessReferenceParam) {
    this.#artifact = ArtifactPath.of(props.artifact);
    this.#element = ElementPath.of(props.element);
    this.#value = props.value;
  }

  static parse(props: WitnessReferenceParam): Result<WitnessReference, ParseError> {
    return parseConstruction(() => new WitnessReference(props));
  }

  static of(props: WitnessReferenceParam): WitnessReference {
    return new WitnessReference(props);
  }

  artifact(): string {
    return this.#artifact.asString();
  }

  element(): string {
    return this.#element.asString();
  }

  value(): string | undefined {
    return this.#value;
  }

  pointsAt(artifact: string, element: string): boolean {
    return this.#artifact.asString() === artifact && this.#element.asString() === element;
  }

  // 検査が証拠の座標を指す門：成果物・要素パス・任意の生の値。
  static at(artifact: string, element: string, value?: string): WitnessReference {
    return new WitnessReference(value === undefined ? { artifact, element } : { artifact, element, value });
  }
}
