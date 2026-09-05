import { TargetIdentifier } from "@deep-spec/kernel-domain";
import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignMachineIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "design-machine-id-too-long", raw: raw.length });
    if (!/^SM-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-design-machine-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignMachineIdentifier {
    return new DesignMachineIdentifier(raw);
  }

  static parse(raw: string): Result<DesignMachineIdentifier, ParseError> {
    return parseConstruction(() => new DesignMachineIdentifier(raw));
  }

  equals(other: DesignMachineIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetIdentifier が所有する順序に従う（裁定 1）。
  compareTo(other: DesignMachineIdentifier): number {
    return this.asTargetId().compareTo(other.asTargetId());
  }

  asString(): string {
    return this.#value;
  }

  // 機械 id は検査対象 id でもある（skip の target 面）。
  asTargetId(): TargetIdentifier {
    return TargetIdentifier.of(this.#value);
  }
}
