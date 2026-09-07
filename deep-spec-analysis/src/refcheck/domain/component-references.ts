import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  FirstClassCollectionBase,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DD_2, DD_3 } from "./component-check-families.ts";
import type { ComponentName } from "./component-name.ts";
import type { ComponentReference } from "./component-reference.ts";
import type { Components } from "./components.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// 依存参照（depends_on / dependents）のファーストクラスコレクション。
export class ComponentReferences
  extends FirstClassCollectionBase<ComponentReference, ComponentReferences>
  implements FirstClassCollection<ComponentReference>
{
  readonly #values: readonly ComponentReference[];

  private constructor(values: readonly ComponentReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-component-references");
  }

  protected override rebuild(values: readonly ComponentReference[]): ComponentReferences {
    return new ComponentReferences(values);
  }

  override map(transform: (element: ComponentReference) => ComponentReference): ComponentReferences {
    return this.mapTo(transform, ComponentReferences.of);
  }

  override combine(other: ComponentReferences): ComponentReferences {
    return this.combineTo(other, ComponentReferences.of);
  }

  static parse(values: readonly ComponentReference[]): Result<ComponentReferences, ParseError> {
    return parseConstruction(() => new ComponentReferences(values));
  }

  static of(values: readonly ComponentReference[]): ComponentReferences {
    return new ComponentReferences(values);
  }

  add(value: ComponentReference): ComponentReferences {
    return new ComponentReferences([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<ComponentReference> {
    yield* this.#values;
  }

  // DD-4 の対称性検査：この参照面が name を挙げているか。
  listsComponent(name: ComponentName): boolean {
    return this.#values.some((r) => r.component().equals(name));
  }

  // DD-2: 未宣言のコンポーネントを指す参照を、走査順のまま finding にする。
  checkDeclared(
    owner: ComponentName,
    components: Components,
    report: ReferenceCheckReport,
    artifact: ArtifactPath,
  ): void {
    for (const reference of this.#values) {
      if (!components.declares(reference.component()))
        report.finding(
          DD_2,
          FindingKind.referenceBroken(),
          FindingTargets.of(
            TargetIdentifier.of(TargetIdentifiers.safe("component", reference.component().asString())),
            [],
          ),
          [WitnessReference.at(artifact.asString(), reference.element().asString(), reference.component().asString())],
          `"${owner.asString()}" references undeclared component "${reference.component().asString()}"`,
        );
    }
  }

  // 境界: DD-3 の witness 生成用。name を指す参照を走査順のまま返す。
  pointingAt(name: ComponentName): ComponentReferences {
    return this.filter((reference) => reference.pointsAt(name));
  }

  // DD-3: owner 自身を指す依存参照を、走査順のまま報告する。
  checkSelfReferences(owner: ComponentName, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const reference of this.pointingAt(owner))
      report.finding(
        DD_3,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", owner.asString())), []),
        [WitnessReference.at(artifact.asString(), reference.element().asString(), owner.asString())],
        `component "${owner.asString()}" lists itself as a dependency`,
      );
  }

  toArray(): readonly ComponentReference[] {
    return this.#values;
  }
}
