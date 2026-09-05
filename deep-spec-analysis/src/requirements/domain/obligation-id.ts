import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { TargetId } from "@deep-spec/kernel-domain";

export class ObligationId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-obligation-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ObligationId {
    return new ObligationId(raw);
  }

  static parse(raw: string): Result<ObligationId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new ObligationId(raw));
  }

  equals(other: ObligationId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: ObligationId): number {
    return this.asTargetId().compareTo(other.asTargetId());
  }

  asString(): string {
    return this.#value;
  }

  // 義務 id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetId {
    return TargetId.of(this.#value);
  }
}
