import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignMachine } from "./design-machine.ts";

// 状態機械のファーストクラスコレクション。全遷移 id の導出を所有する。
export class DesignMachines extends FirstClassCollectionBase<DesignMachine, DesignMachines> {
  readonly #values: readonly DesignMachine[];

  private constructor(values: readonly DesignMachine[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-machines");
  }

  protected override rebuild(values: readonly DesignMachine[]): DesignMachines {
    return new DesignMachines(values);
  }

  static of(values: readonly DesignMachine[]): DesignMachines {
    return new DesignMachines(values);
  }

  override map(transform: (element: DesignMachine) => DesignMachine): DesignMachines {
    return this.mapTo(transform, DesignMachines.of);
  }

  override combine(other: DesignMachines): DesignMachines {
    return this.combineTo(other, DesignMachines.of);
  }

  static parse(values: readonly DesignMachine[]): Result<DesignMachines, ParseError> {
    return parseConstruction(() => new DesignMachines(values));
  }

  add(value: DesignMachine): DesignMachines {
    return new DesignMachines([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignMachine> {
    yield* this.#values;
  }

  // 機械 id の列（ユニット内 id 一意性検査の材料）。
  ids(): readonly string[] {
    return this.#values.map((m) => m.id().asString());
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
