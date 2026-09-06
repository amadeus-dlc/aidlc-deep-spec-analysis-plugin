import type { AttributePath } from "@deep-spec-analysis/kernel-domain";
import type { ObligationIdentifier, ScenarioIdentifier } from "@deep-spec-analysis/requirements-domain";
import type { UnmappedTarget } from "./unmapped-target.ts";

// unmapped[]（写像しないことの明示宣言＝waiver）のコレクション。理由の索引は
// 旧 new Map(...) の凍結挙動どおり重複 target は最後の宣言が勝つ。
export class UnmappedDeclarations {
  readonly #values: readonly UnmappedTarget[];

  private constructor(values: readonly UnmappedTarget[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly UnmappedTarget[]): UnmappedDeclarations {
    return new UnmappedDeclarations(values);
  }

  add(value: UnmappedTarget): UnmappedDeclarations {
    return new UnmappedDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnmappedTarget> {
    yield* this.#values;
  }

  covers(target: AttributePath | ObligationIdentifier | ScenarioIdentifier): boolean {
    const t = target.asString();
    return this.#values.some((x) => x.isFor(t));
  }

  reasonOf(target: AttributePath | ObligationIdentifier | ScenarioIdentifier): string | undefined {
    const t = target.asString();
    let found: string | undefined;
    for (const x of this.#values) {
      if (x.isFor(t)) found = x.reason();
    }
    return found;
  }

  toArray(): readonly UnmappedTarget[] {
    return this.#values;
  }
}
