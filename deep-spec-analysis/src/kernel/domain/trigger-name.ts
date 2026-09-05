import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// イベントのトリガ名。空文字は値として成立せず、未宣言は所有側の undefined で表す。

export class TriggerName {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-trigger-name", raw });
    this.#value = raw;
  }

  static of(raw: string): TriggerName {
    return new TriggerName(raw);
  }

  static parse(raw: string): Result<TriggerName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new TriggerName(raw));
  }

  equals(other: TriggerName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
