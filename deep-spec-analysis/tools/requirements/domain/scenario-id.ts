import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { TargetId } from "../../kernel/domain/index.ts";

type ScenarioIdError = { readonly kind: "empty-scenario-id"; readonly raw: string };

export class ScenarioId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ScenarioId, ScenarioIdError> {
    if (raw === "") return err({ kind: "empty-scenario-id", raw });
    return ok(new ScenarioId(raw));
  }

  static reconstitute(raw: string): ScenarioId {
    return new ScenarioId(raw);
  }

  equals(other: ScenarioId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  // シナリオ id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetId {
    return TargetId.reconstitute(this.#value);
  }
}
