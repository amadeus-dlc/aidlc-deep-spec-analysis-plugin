import type { DesignMachine } from "./design-machine.ts";

// 状態機械のファーストクラスコレクション。全遷移 id の導出を所有する。
export class DesignMachines {
  readonly #values: readonly DesignMachine[];

  private constructor(values: readonly DesignMachine[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignMachine[]): DesignMachines {
    return new DesignMachines(values);
  }

  add(value: DesignMachine): DesignMachines {
    return new DesignMachines([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignMachine> {
    yield* this.#values;
  }

  transitionIds(): readonly string[] {
    return this.#values.flatMap((m) => [...m.transitions().ids()]);
  }

  // 到達不能状態プローブの凍結順：id 辞書順（レガシー逐語の equal→1 比較。
  // 重複 id は well-formedness が surface する）。
  sortedById(): DesignMachines {
    return new DesignMachines([...this.#values].sort((a, b) => (a.id().asString() < b.id().asString() ? -1 : 1)));
  }

  // lowering の凍結順：id の正準順（sortedById＝probe 凍結順とは別面）。
  sortedCanonically(): DesignMachines {
    return new DesignMachines([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }

  // 機械の生涯属性の座標（entity.attribute——lowering・触媒・文言の共有導出）。
  static attrPathOf(sm: DesignMachine): string {
    return `${sm.entity().asString()}.${sm.attribute().asString()}`;
  }

  toArray(): readonly DesignMachine[] {
    return this.#values;
  }
}
