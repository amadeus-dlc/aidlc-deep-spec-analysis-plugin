// refinement 証拠が失効した intent の行——要件が設計検証の後に再検証された。
// presenter は intent ラベルを行に作らせる（#71 波27）。
export class RefinementStaleRow {
  readonly #space: string;
  readonly #intent: string;

  private constructor(space: string, intent: string) {
    this.#space = space;
    this.#intent = intent;
  }

  static of(props: { space: string; intent: string }): RefinementStaleRow {
    return new RefinementStaleRow(props.space, props.intent);
  }

  intent(): string {
    return this.#intent;
  }

  intentLabel(): string {
    return `${this.#space}/${this.#intent}`;
  }
}
