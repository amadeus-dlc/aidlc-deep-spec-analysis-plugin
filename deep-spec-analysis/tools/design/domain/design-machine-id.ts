import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { TargetId } from "../../kernel/domain/index.ts";

type DesignMachineTokenError = { readonly kind: "empty-machine-token"; readonly raw: string };

export class DesignMachineId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignMachineId, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignMachineId(raw));
  }

  static reconstitute(raw: string): DesignMachineId {
    return new DesignMachineId(raw);
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
    return TargetId.reconstitute(this.#value);
  }
}
