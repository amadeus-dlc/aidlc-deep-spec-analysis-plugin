import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// rules.md の source 欄から抽出された FR/NFR 参照。
export class SourceId {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): SourceId {
    return new SourceId(raw);
  }

  static parse(raw: string): Result<SourceId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new SourceId(raw));
  }
  equals(other: SourceId): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
