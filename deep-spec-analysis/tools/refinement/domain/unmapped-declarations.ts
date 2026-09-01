import type { RefTokenCarrier } from "./ref-token-carrier.ts";
import type { UnmappedTarget } from "./unmapped-target.ts";

function tokenOf(carrier: RefTokenCarrier): string {
  return typeof carrier === "string" ? carrier : carrier.asString();
}

// unmapped[]（写像しないことの明示宣言＝waiver）のコレクション。理由の索引は
// 旧 new Map(...) の凍結挙動どおり重複 target は最後の宣言が勝つ。
export class UnmappedDeclarations {
  readonly #values: readonly UnmappedTarget[];

  private constructor(values: readonly UnmappedTarget[]) {
    this.#values = values;
  }

  static of(values: readonly UnmappedTarget[]): UnmappedDeclarations {
    return new UnmappedDeclarations([...values]);
  }

  add(value: UnmappedTarget): UnmappedDeclarations {
    return new UnmappedDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnmappedTarget> {
    yield* this.#values;
  }

  covers(target: RefTokenCarrier): boolean {
    const t = tokenOf(target);
    return this.#values.some((x) => x.target.asString() === t);
  }

  coversAll(targets: readonly RefTokenCarrier[]): boolean {
    return targets.every((t) => this.covers(t));
  }

  reasonOf(target: RefTokenCarrier): string | undefined {
    const t = tokenOf(target);
    let found: string | undefined;
    for (const x of this.#values) {
      if (x.target.asString() === t) found = x.reason;
    }
    return found;
  }

  toArray(): readonly UnmappedTarget[] {
    return this.#values;
  }
}
