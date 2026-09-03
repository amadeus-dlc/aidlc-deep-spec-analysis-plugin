import type { UnitDecls } from "./unit-decls.ts";
import type { UnitName } from "../../kernel/domain/index.ts";
import { UnitNames } from "./unit-names.ts";

// units エッジブロックの 1 宣言（unit 名と depends_on）。CD-3 が走査する
// 「宣言済みの依存先を値順に」は宣言自身の知識——宙に浮いた辺（未宣言の
// 依存先）は units-generation の問題として黙る（#71 波14）。
export class UnitDecl {
  readonly #name: UnitName;
  readonly #dependsOn: UnitNames;

  private constructor(props: { name: UnitName; dependsOn: UnitNames }) {
    this.#name = props.name;
    this.#dependsOn = props.dependsOn;
  }

  static reconstitute(props: { name: UnitName; dependsOn: UnitNames }): UnitDecl {
    return new UnitDecl(props);
  }

  name(): UnitName {
    return this.#name;
  }

  dependsOn(): UnitNames {
    return this.#dependsOn;
  }

  // 宣言済みユニットへの依存先を値順で（未宣言の辺は落とす——凍結挙動）。
  declaredDependencies(declared: UnitDecls): readonly UnitName[] {
    return [...this.#dependsOn.sortedByValue()].filter((dep) => declared.declares(dep.asString()));
  }
}
