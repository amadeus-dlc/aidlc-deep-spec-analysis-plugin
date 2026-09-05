import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { TargetId } from "@deep-spec/kernel-domain";

export class DesignMachineId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignMachineId {
    return new DesignMachineId(raw);
  }

  static parse(raw: string): Result<DesignMachineId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new DesignMachineId(raw));
  }

  equals(other: DesignMachineId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignMachineId): number {
    return this.asTargetId().compareTo(other.asTargetId());
  }

  asString(): string {
    return this.#value;
  }

  // 機械 id は検査対象 id でもある（skip の target 面）。
  asTargetId(): TargetId {
    return TargetId.of(this.#value);
  }
}
